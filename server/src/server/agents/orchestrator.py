import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from strands import Agent, tool

from server.config import settings
from server.core.llm import get_model, get_fast_retry_strategy
from server.core.presidio_sanitizer import sanitizer
from server.agents.intake_agent import create_intake_agent, extract_profile, ApplicantProfile
from server.agents.matching_agent import create_matching_agent, match_programs, MatchingResult
from server.agents.document_agent import create_document_agent, generate_application_pack, ApplicationDraft
from server.tools.search_tools import hybrid_search_programs as _raw_search
from server.tools.eligibility_tools import check_program_eligibility as _raw_check_eligibility
from server.tools.document_tools import get_programs_requirements as _raw_get_requirements

log = logging.getLogger(__name__)


# Redis based session store with in-memory fallback for local dev.
class SessionState(BaseModel):
    session_id: str
    applicant_profile: ApplicantProfile = Field(default_factory=lambda: ApplicantProfile(summary="New applicant"))
    matching_result: Optional[MatchingResult] = None
    application_draft: Optional[ApplicationDraft] = None
    history: List[Dict[str, str]] = Field(default_factory=list)
    last_matched_snapshot: Optional[Dict[str, Any]] = None
    pii_vault: Dict[str, str] = Field(default_factory=dict)
    clarification_attempts: int = 0


class SessionStore:
    def __init__(self, ttl_seconds: int = 60 * 60 * 24):
        self.ttl_seconds = ttl_seconds
        self._redis = None
        self._memory_fallback: Dict[str, SessionState] = {}
        try:
            import redis
            redis_url = getattr(settings, "REDIS_URL", None)
            if redis_url:
                self._redis = redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
                log.info(f"[SessionStore] Connected to Redis at {redis_url}")
            else:
                log.warning("REDIS_URL not configured -- falling back to in-memory session store.")
        except Exception as e:
            log.warning(f"Could not connect to Redis ({e}) -- falling back to in-memory session store.")
            self._redis = None

    def _key(self, session_id: str) -> str:
        return f"aid-navigator:session:{session_id}"

    def get(self, session_id: str) -> SessionState:
        if self._redis:
            try:
                raw = self._redis.get(self._key(session_id))
                if raw:
                    return SessionState.model_validate_json(raw)
                return SessionState(session_id=session_id)
            except Exception as e:
                log.warning(f"[SessionStore] Redis get error for {session_id} ({e}), falling back to memory.")
        return self._memory_fallback.get(session_id, SessionState(session_id=session_id))

    def save(self, session: SessionState) -> None:
        if self._redis:
            try:
                self._redis.set(self._key(session.session_id), session.model_dump_json(), ex=self.ttl_seconds)
                return
            except Exception as e:
                log.warning(f"[SessionStore] Redis set error for {session.session_id} ({e}), falling back to memory.")
        self._memory_fallback[session.session_id] = session

    def reset(self, session_id: str) -> None:
        if self._redis:
            try:
                self._redis.delete(self._key(session_id))
            except Exception as e:
                log.warning(f"[SessionStore] Redis delete error for {session_id} ({e}).")
        self._memory_fallback.pop(session_id, None)


class NavigatorResponse(BaseModel):
    session_id: str
    reply_message: str
    clarification_needed: bool
    applicant_profile: ApplicantProfile
    matching_result: Optional[MatchingResult] = None
    application_draft: Optional[ApplicationDraft] = None


NAVIGATOR_SYSTEM_PROMPT = """
You are the Lead Community Aid Navigator, an empathetic, multilingual advocate helping individuals and families navigate public assistance, social safety net programs, and emergency benefits worldwide (including India, the United States, the UK, Canada, and global aid frameworks).

Your role:
1. Warmly answer questions about eligibility, program details, or application processes across national and state programs.
2. Ground your explanations in official statutory rules using your tools.
3. Be reassuring, non-judgmental, practical, and culturally empathetic.
4. If eligibility is unverifiable, NEVER state it as confirmed or excluded -- state exactly what info is missing.

Applicant Context (from current session state):
{state_context}
"""


def _is_question_or_inquiry(text: str) -> bool:
    t = text.strip().lower()
    starters = ("why", "what", "how", "can i", "could i", "where", "is there", "are there", "who", "tell me", "explain", "do i", "does", "which")
    if any(t.startswith(s) for s in starters) or "?" in t:
        return True
    inquiry_keywords = ["detail", "more info", "requirement", "qualify", "why not", "how does", "what if", "help me understand", "can you tell"]
    return any(k in t for k in inquiry_keywords)


def _merge_profiles(base: ApplicantProfile, update: ApplicantProfile) -> ApplicantProfile:
    """Merges new extracted fields into existing session profile without losing prior context."""
    data = base.model_dump()
    update_data = update.model_dump()

    for k, v in update_data.items():
        if k == "primary_needs":
            combined = list(dict.fromkeys(data.get("primary_needs", []) + v))
            data["primary_needs"] = combined
        elif v is not None and k not in ("missing_critical_fields", "clarification_question", "summary"):
            # Protect against LLMs returning empty strings or "unknown" instead of null
            if isinstance(v, str) and v.strip().lower() in ["", "unknown", "none", "null"]:
                continue
            data[k] = v

    missing = []

    # Check income: known if not None (including 0.0)
    if data.get("annual_income") is None:
        missing.append("income")

    # Check location: known if borough, city_district, state_province, or country is provided
    has_location = bool(data.get("borough") or data.get("city_district") or data.get("state_province") or data.get("country"))
    if not has_location:
        missing.append("borough")

    data["missing_critical_fields"] = missing

    if not missing:
        data["clarification_question"] = None
    elif update.clarification_question:
        data["clarification_question"] = update.clarification_question
    else:
        data["clarification_question"] = "Could you please share your country and city/borough, along with your approximate annual household income so we can find exact matching aid?"

    if update.summary and update.summary not in ("New applicant", "Unknown", ""):
        data["summary"] = update.summary

    return ApplicantProfile(**data)


_MATCH_RELEVANT_FIELDS = (
    "annual_income", "borough", "monthly_rent", "household_size",
    "age", "has_disability_benefits", "disability_benefit_types",
    "has_children_under_5", "is_homeowner",
    "country", "state_province", "city_district", "currency",
)


def _profile_match_snapshot(profile: ApplicantProfile) -> Dict[str, Any]:
    data = profile.model_dump()
    return {f: data.get(f) for f in _MATCH_RELEVANT_FIELDS}


def _make_session_scoped_tools(principal_id: str, principal_role: str, org_id: Optional[str]):
    """Builds auth-injected tools for this specific turn."""
    @tool(name="hybrid_search_programs", description="Performs hybrid semantic vector and keyword search across open aid programs.")
    def _search(query: str, limit: int = 5, include_closed: bool = False) -> List[Dict[str, Any]]:
        return _raw_search(query, limit, principal_id, principal_role, org_id, include_closed)

    @tool(name="check_program_eligibility", description="Evaluates deterministic eligibility rules. Returns True/False/None.")
    def _check_eligibility(program_id: str, annual_income: Optional[float] = None, household_size: Optional[int] = None, age: Optional[int] = None, region: Optional[str] = None, has_disability_benefits: Optional[bool] = None, disability_benefit_types: Optional[List[str]] = None, has_children: Optional[bool] = None, is_homeowner: Optional[bool] = None, monthly_rent: Optional[float] = None) -> Dict[str, Any]:
        return _raw_check_eligibility(program_id, principal_id, principal_role, org_id, annual_income, household_size, age, region, None, has_disability_benefits, disability_benefit_types, has_children, is_homeowner, monthly_rent)

    @tool(name="get_programs_requirements", description="Fetches required documents and application info for MULTIPLE programs.")
    def _get_requirements(program_ids: List[str]) -> Dict[str, Any]:
        return _raw_get_requirements(program_ids)

    return [_search, _check_eligibility, _get_requirements]


MAX_CLARIFICATION_ATTEMPTS = 2


class CommunityAidOrchestrator:
    def __init__(self, session_store: Optional[SessionStore] = None):
        self.store = session_store or SessionStore()

    def process_user_turn(self, user_message: str, session_id: str, principal_id: str, principal_role: str, org_id: Optional[str]) -> NavigatorResponse:
        session = self.store.get(session_id)
        sanitized_text, turn_vault = sanitizer.sanitize(user_message)
        session.pii_vault.update(turn_vault)

        # 1. Intake Phase (Safe Execution)
        try:
            intake_agent = create_intake_agent()
            new_profile = extract_profile(sanitized_text, agent=intake_agent, preferred_language=session.applicant_profile.preferred_language)
            session.applicant_profile = _merge_profiles(session.applicant_profile, new_profile)
        except Exception as e:
            log.error(f"[Orchestrator] Intake failed: {e}")

        profile = session.applicant_profile
        is_question = _is_question_or_inquiry(sanitized_text)

        # 2. Clarification Loop: do NOT intercept questions!
        if profile.missing_critical_fields and not session.matching_result and not is_question:
            if session.clarification_attempts < MAX_CLARIFICATION_ATTEMPTS:
                session.clarification_attempts += 1
                reply = profile.clarification_question or "Could you share your country, city or borough, and approximate income to help find exact matches?"
                return self._finish_turn(session, user_message, reply, True, sanitized_text)

        # 3. Matching & Drafting Phase
        current_snapshot = _profile_match_snapshot(profile)
        if not session.matching_result or current_snapshot != session.last_matched_snapshot:
            try:
                session.matching_result = match_programs(profile, agent=create_matching_agent())
                session.last_matched_snapshot = current_snapshot

                confirmed = [m for m in session.matching_result.ranked_programs if m.is_deterministically_eligible is True]
                unverified = [m for m in session.matching_result.ranked_programs if m.is_deterministically_eligible is None]

                if confirmed:
                    session.clarification_attempts = 0
                    eligibility_map = {m.program_id: {"eligible": True} for m in confirmed}
                    session.application_draft = generate_application_pack(
                        program_ids=[m.program_id for m in confirmed[:3]],
                        applicant_summary=profile.summary,
                        eligibility_by_program=eligibility_map,
                        agent=create_document_agent()
                    )
                elif unverified and not is_question and session.clarification_attempts < MAX_CLARIFICATION_ATTEMPTS:
                    missing_bits = list(set(b.strip() for m in unverified for b in getattr(m, "unverifiable_checks", []) + getattr(m, "potential_blockers", []) if b.strip()))
                    if missing_bits:
                        session.clarification_attempts += 1
                        reply = f"You may qualify for {unverified[0].name}, but I need to confirm: {'; '.join(missing_bits[:2])}. Could you share that?"
                        return self._finish_turn(session, user_message, reply, True, sanitized_text)
            except Exception as e:
                log.error(f"[Orchestrator] Matching/Drafting failed: {e}")

        # 4. Question Answering / Summarization
        reply = self._answer_question(session, profile, sanitized_text, principal_id, principal_role, org_id) if is_question else self._summarize_match_status(session)
        return self._finish_turn(session, user_message, reply, False, sanitized_text)

    def _answer_question(self, session: SessionState, profile: ApplicantProfile, sanitized_text: str, principal_id: str, principal_role: str, org_id: Optional[str]) -> str:
        model = get_model()
        if not model:
            return self._deterministic_question_reply(sanitized_text, session)

        try:
            state_context = f"Matched: {len(session.matching_result.ranked_programs) if session.matching_result else 0} programs. "
            if session.application_draft:
                state_context += f"Drafted checklist for {len(session.application_draft.selected_programs)} programs."

            navigator_agent = Agent(
                name="CommunityAidNavigator",
                system_prompt=NAVIGATOR_SYSTEM_PROMPT.format(state_context=state_context),
                tools=_make_session_scoped_tools(principal_id, principal_role, org_id),
                model=model,
                retry_strategy=get_fast_retry_strategy(max_attempts=2),
            )

            agent_res = navigator_agent(
                sanitized_text,
                messages=session.history
            )
            return str(agent_res).strip()
        except Exception as e:
            log.warning(f"[Orchestrator] Navigator agent error, falling back: {e}")
            return self._deterministic_question_reply(sanitized_text, session)

    def _summarize_match_status(self, session: SessionState) -> str:
        if not session.matching_result:
            return "I'm here to help. Could you tell me a little more about your current housing, health, or financial situation?"

        confirmed = [m for m in session.matching_result.ranked_programs if m.is_deterministically_eligible is True]
        unverified = [m for m in session.matching_result.ranked_programs if m.is_deterministically_eligible is None]

        if confirmed:
            names = [m.name for m in confirmed]
            return (
                f"Based on your situation, I found {len(confirmed)} aid programs you qualify for: "
                f"{', '.join(names)}. I have prepared your personalized document checklist and draft application below. "
                f"Feel free to ask any questions about why you qualify, what documents you need, or how to apply!"
            )
        if unverified:
            names = [m.name for m in unverified]
            missing_details = []
            for m in unverified:
                missing_details.extend(getattr(m, "unverifiable_checks", []))
            clean_details = list(dict.fromkeys([d.strip() for d in missing_details if d.strip()]))
            detail_str = f" (specifically: {'; '.join(clean_details[:2])})" if clean_details else ""
            return (
                f"I found {len(unverified)} program(s) you might qualify for ({', '.join(names)}), but I still need "
                f"a bit more information to confirm{detail_str}. Let me know more about your situation and I'll check again."
            )
        return (
            "I searched our aid programs, but none of the current matches satisfy the hard eligibility rules "
            "(such as income ceilings or specific benefit requirements) based on what you've shared so far. "
            "A caseworker can review your case for special exemptions. Feel free to ask about any specific program!"
        )

    def _deterministic_question_reply(self, query: str, session: SessionState) -> str:
        q_lower = query.lower()
        replies = []
        if session.matching_result:
            for p in session.matching_result.ranked_programs:
                if (
                    p.program_id.lower() in q_lower
                    or p.name.lower() in q_lower
                    or ("scrie" in q_lower and "scrie" in p.program_id)
                    or ("drie" in q_lower and "drie" in p.program_id)
                    or ("pmjay" in q_lower and "pmjay" in p.program_id)
                    or ("ayushman" in q_lower and "pmjay" in p.program_id)
                    or ("kisan" in q_lower and "pmkisan" in p.program_id)
                    or ("awas" in q_lower and "pmay" in p.program_id)
                    or ("ration" in q_lower and "pds" in p.program_id)
                    or ("mgnrega" in q_lower and "mgnrega" in p.program_id)
                ):
                    if p.is_deterministically_eligible is None:
                        needed = "; ".join(p.unverifiable_checks or p.potential_blockers or ["additional details"])
                        replies.append(
                            f"Regarding {p.name}: I cannot confirm eligibility yet -- still need: {needed}."
                        )
                    elif p.potential_blockers:
                        replies.append(f"Regarding {p.name}: Potential blockers noted include: {'; '.join(p.potential_blockers)}. Your passed criteria were: {'; '.join(p.passed_criteria)}.")
                    else:
                        replies.append(f"Regarding {p.name}: You are eligible! Passed checks: {'; '.join(p.passed_criteria)}. {p.plain_language_reason}")

        if replies:
            return "\n\n".join(replies)

        return (
            "I am reviewing your benefits profile. You can check the eligibility details in the cards above, "
            "or contact a caseworker to explore special exemptions."
        )

    def _finish_turn(
        self,
        session: SessionState,
        raw_user_message: str,
        reply: str,
        clarification_needed: bool,
        sanitized_text: Optional[str] = None,
    ) -> NavigatorResponse:
        rehydrated_reply = sanitizer.rehydrate(reply, session.pii_vault)

        session.history.append({"role": "user", "content": sanitized_text or raw_user_message})
        session.history.append({"role": "assistant", "content": reply})

        self.store.save(session)

        return NavigatorResponse(
            session_id=session.session_id,
            reply_message=rehydrated_reply,
            clarification_needed=clarification_needed,
            applicant_profile=session.applicant_profile,
            matching_result=session.matching_result,
            application_draft=session.application_draft
        )


orchestrator = CommunityAidOrchestrator()


def _get_redis_client():
    """Returns the Redis client from the orchestrator's session store, if connected."""
    return orchestrator.store._redis
