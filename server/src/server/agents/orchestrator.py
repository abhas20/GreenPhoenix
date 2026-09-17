import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from strands import Agent, tool

from server.config import settings
from server.core.llm import get_model
from server.core.presidio_sanitizer import sanitizer
from server.agents.intake_agent import create_intake_agent, extract_profile, ApplicantProfile
from server.agents.matching_agent import create_matching_agent, match_programs, MatchingResult
from server.agents.document_agent import create_document_agent, generate_application_pack, ApplicationDraft
from server.tools.search_tools import hybrid_search_programs as _raw_search
from server.tools.eligibility_tools import check_program_eligibility as _raw_check_eligibility
from server.tools.document_tools import get_program_requirements as _raw_get_requirements

log = logging.getLogger(__name__)


# Redis based session store with in-memory fallback for local dev.
# Session state is not persisted long-term -- it is only used to maintain context across turns in a single conversation.
class SessionState(BaseModel):
    session_id: str
    applicant_profile: ApplicantProfile = Field(default_factory=lambda: ApplicantProfile(summary="New applicant"))
    matching_result: Optional[MatchingResult] = None
    application_draft: Optional[ApplicationDraft] = None
    history: List[Dict[str, str]] = Field(default_factory=list)
    last_matched_snapshot: Optional[Dict[str, Any]] = None
    pii_vault: Dict[str, str] = Field(default_factory=dict)


class SessionStore:
    def __init__(self, ttl_seconds: int = 60 * 60 * 24):
        self.ttl_seconds = ttl_seconds
        self._redis = None
        self._memory_fallback: Dict[str, SessionState] = {}
        try:
            import redis  # lazy import
            redis_url = getattr(settings, "REDIS_URL", None)
            if redis_url:
                self._redis = redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
                log.info(f"[SessionStore] Connected to Redis at {redis_url}")
            else:
                log.warning("REDIS_URL not configured -- falling back to in-memory session store. "
                            "This will lose all sessions on restart and will not work correctly "
                            "with more than one process/container/Lambda instance.")
        except Exception as e:
            log.warning(f"Could not connect to Redis ({e}) -- falling back to in-memory session store. "
                        "Fine for local dev, NOT safe for Lambda or multi-instance deployment.")
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
You are the Lead Community Aid Navigator, a compassionate, highly knowledgeable, and empowering advocate helping New York City residents navigate public benefits and crisis aid programs.

Your role:
1. Warmly and clearly answer any questions the user has about their aid eligibility, program details, document requirements, application processes, or why they did or did not qualify for specific programs.
2. Ground your explanations in official program rules: Use your search/eligibility/requirements tools if you need to look up specific criteria or program details.
3. Be reassuring, non-judgmental, and practical. When explaining potential blockers (like age minimums or income thresholds), suggest realistic alternatives or caseworker consultations.
4. If a program's eligibility is unverifiable (not confirmed True or False), NEVER state it as confirmed or excluded -- say plainly what information is still needed.
5. Keep answers conversational, empathetic, and structured (use bullet points when listing steps or documents).
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
            data[k] = v

    missing = []
    if data.get("annual_income") is None:
        missing.append("income")
    if data.get("borough") is None:
        missing.append("borough")
    data["missing_critical_fields"] = missing

    if not missing:
        data["clarification_question"] = None
    elif update.clarification_question:
        data["clarification_question"] = update.clarification_question

    if update.summary and update.summary not in ("New applicant", "Unknown", ""):
        data["summary"] = update.summary

    return ApplicantProfile(**data)


_MATCH_RELEVANT_FIELDS = (
    "annual_income", "borough", "monthly_rent", "household_size",
    "age", "has_disability_benefits", "disability_benefit_types",
    "has_children_under_5", "is_homeowner",
)


def _profile_match_snapshot(profile: ApplicantProfile) -> Dict[str, Any]:
    data = profile.model_dump()
    return {f: data.get(f) for f in _MATCH_RELEVANT_FIELDS}


def _make_session_scoped_tools(principal_id: str, principal_role: str, org_id: Optional[str]):
    """
    Builds fresh @tool-wrapped closures for this specific session/turn, with
    the REAL principal baked in server-side. The LLM never sees or controls
    principal_id/role/org_id as parameters -- it can't spoof them, and Cedar
    always evaluates against who's actually talking, not a tool default.
    """

    @tool(name="hybrid_search_programs", description="Performs hybrid semantic vector and keyword search across open aid programs.")
    def _search(query: str, limit: int = 5, include_closed: bool = False) -> List[Dict[str, Any]]:
        return _raw_search(
            query=query, limit=limit,
            principal_id=principal_id, principal_role=principal_role, org_id=org_id,
            include_closed=include_closed,
        )

    @tool(name="check_program_eligibility", description="Evaluates hard deterministic eligibility rules for a program. Result is True/False/None -- None means unverifiable, not ineligible.")
    def _check_eligibility(
        program_id: str,
        annual_income: Optional[float] = None,
        household_size: Optional[int] = None,
        age: Optional[int] = None,
        region: Optional[str] = None,
        has_disability_benefits: Optional[bool] = None,
        disability_benefit_types: Optional[List[str]] = None,
        has_children: Optional[bool] = None,
        is_homeowner: Optional[bool] = None,
        monthly_rent: Optional[float] = None,
    ) -> Dict[str, Any]:
        return _raw_check_eligibility(
            program_id=program_id,
            principal_id=principal_id, principal_role=principal_role, org_id=org_id,
            annual_income=annual_income, household_size=household_size, age=age, region=region,
            has_disability_benefits=has_disability_benefits, disability_benefit_types=disability_benefit_types,
            has_children=has_children, is_homeowner=is_homeowner, monthly_rent=monthly_rent,
        )

    @tool(name="get_program_requirements", description="Fetches required documents and application info for a program.")
    def _get_requirements(program_id: str) -> Dict[str, Any]:
        return _raw_get_requirements(program_id=program_id)

    return [_search, _check_eligibility, _get_requirements]


class CommunityAidOrchestrator:
    """
    Manager orchestrating Intake, Matching, and Document sub-agents.

    Deployment-agnostic by design: no in-process state that would break on
    Lambda's ephemeral containers or on multiple concurrent instances.
    - Session state lives in SessionStore (Redis), not in this object.
    - Sub-agents are created FRESH per turn, not reused as singletons --
      Strands Agents accumulate their own message history by default, and a
      shared long-lived agent instance would leak one user's conversation
      into another's context the moment two sessions run concurrently.
    This class itself can be instantiated once per request (cheap) or once
    per process (also fine) -- it holds no per-user state either way.
    """

    def __init__(self, session_store: Optional[SessionStore] = None):
        self.store = session_store or SessionStore()

    def reset_session(self, session_id: str) -> None:
        self.store.reset(session_id)

    def process_user_turn(
        self,
        user_message: str,
        session_id: str = "session_default",
        principal_id: str = "unknown",
        principal_role: str = "PublicApplicant",
        org_id: Optional[str] = None,
    ) -> NavigatorResponse:
        try:
            return self._process_user_turn(user_message, session_id, principal_id, principal_role, org_id)
        except Exception as e:
            log.exception(f"[Orchestrator] Unhandled error processing turn for session {session_id}: {e}")
            return NavigatorResponse(
                session_id=session_id,
                reply_message=(
                    "I'm having trouble processing that right now. Nothing was lost -- "
                    "please try again in a moment, or reach out to a caseworker if this keeps happening."
                ),
                clarification_needed=False,
                applicant_profile=ApplicantProfile(summary="Error recovering profile"),
                matching_result=None,
                application_draft=None,
            )

    def _process_user_turn(
        self,
        user_message: str,
        session_id: str,
        principal_id: str,
        principal_role: str,
        org_id: Optional[str],
    ) -> NavigatorResponse:
        session = self.store.get(session_id)

        # PII Sanitization
        sanitized_text, turn_vault = sanitizer.sanitize(user_message)
        session.pii_vault.update(turn_vault)

        # Fresh, stateless Intake agent for this turn only.
        intake_agent = create_intake_agent()
        new_profile = extract_profile(sanitized_text, agent=intake_agent, preferred_language=session.applicant_profile.preferred_language)
        session.applicant_profile = _merge_profiles(session.applicant_profile, new_profile)
        profile = session.applicant_profile

        is_question = _is_question_or_inquiry(sanitized_text)

        # Clarification check for critical fields
        if profile.missing_critical_fields and session.matching_result is None:
            reply = profile.clarification_question or (
                "To help connect you with the right NYC programs, could you share your borough and approximate income?"
            )
            return self._finish_turn(session, user_message, reply, clarification_needed=True, sanitized_text=sanitized_text)

        # Re-run matching only if something that actually affects
        # eligibility changed since the last time we matched -- not just
        # because the field was mentioned again with the same value.
        current_snapshot = _profile_match_snapshot(profile)
        should_run_matching = (
            not profile.missing_critical_fields
            and (session.matching_result is None or current_snapshot != session.last_matched_snapshot)
        )

        if should_run_matching:
            matching_agent = create_matching_agent()
            match_res = match_programs(profile, agent=matching_agent)
            session.matching_result = match_res
            session.last_matched_snapshot = current_snapshot

            confirmed = [m for m in match_res.ranked_programs if m.is_deterministically_eligible is True]
            unverified = [m for m in match_res.ranked_programs if m.is_deterministically_eligible is None]

            if confirmed:
                eligibility_map = {m.program_id: {"eligible": m.is_deterministically_eligible} for m in match_res.ranked_programs}
                top_program_ids = [m.program_id for m in confirmed[:3]]
                document_agent = create_document_agent()
                session.application_draft = generate_application_pack(
                    program_ids=top_program_ids,
                    applicant_summary=profile.summary,
                    eligibility_by_program=eligibility_map,
                    agent=document_agent,
                )
            elif unverified and not is_question:
                # Some programs are ONE missing
                # field away from a confirmed match -- this is the
                # Matching -> Intake feedback loop: ask for what's needed
                # instead of silently dropping these programs or telling
                # the applicant they don't qualify.
                missing_bits = sorted({
                    reason for m in unverified for reason in getattr(m, "potential_blockers", [])
                })
                if missing_bits:
                    return self._finish_turn(
                        session, user_message,
                        "You may qualify for a few more programs, but I need a bit more information first: "
                        + "; ".join(missing_bits[:3]) + ". Could you share that?",
                        clarification_needed=True,
                        sanitized_text=sanitized_text,
                    )

        # Formulate response
        reply = ""

        if is_question:
            reply = self._answer_question(session, profile, sanitized_text, principal_id, principal_role, org_id)

        if not reply:
            reply = self._summarize_match_status(session)

        return self._finish_turn(session, user_message, reply, clarification_needed=False, sanitized_text=sanitized_text)

    def _answer_question(
        self,
        session: SessionState,
        profile: ApplicantProfile,
        sanitized_text: str,
        principal_id: str,
        principal_role: str,
        org_id: Optional[str],
    ) -> str:
        model = get_model()
        if model:
            try:
                tools = _make_session_scoped_tools(principal_id, principal_role, org_id)
                navigator_agent = Agent(
                    name="CommunityAidNavigator",
                    system_prompt=NAVIGATOR_SYSTEM_PROMPT,
                    tools=tools,
                    model=model,
                )

                matched_summary = "None yet"
                if session.matching_result:
                    matched_summary = "\n".join([
                        f"- {m.name} ({m.program_id}): Eligible={m.is_deterministically_eligible}, "
                        f"Passed={m.passed_criteria}, Blockers={m.potential_blockers}, Reason={m.plain_language_reason}"
                        for m in session.matching_result.ranked_programs
                    ])

                docs_summary = "None yet"
                if session.application_draft:
                    docs_summary = ", ".join([d.document_name for d in session.application_draft.consolidated_checklist])

                nav_prompt = (
                    f"Applicant Message: {sanitized_text}\n\n"
                    f"Current Applicant Profile:\n"
                    f"- Borough: {profile.borough}\n"
                    f"- Household Size: {profile.household_size}\n"
                    f"- Annual Income: ${profile.annual_income if profile.annual_income is not None else 0:,.0f}\n"
                    f"- Monthly Rent: ${profile.monthly_rent if profile.monthly_rent is not None else 0:,.0f}\n"
                    f"- Disability Benefits: {profile.has_disability_benefits}\n"
                    f"- Age: {profile.age}\n"
                    f"- Primary Needs: {profile.primary_needs}\n\n"
                    f"Evaluated Aid Programs:\n{matched_summary}\n\n"
                    f"Application Documents Prepared: {docs_summary}\n\n"
                    f"Instructions: Answer the applicant's question with empathy, precision, and clarity. "
                    f"Use tools to look up rules or requirements if needed. Be warm, supportive, and practical. "
                    f"If a program's eligibility is None (unverifiable), say what's still needed rather than "
                    f"stating it as confirmed or excluded."
                )
                agent_res = navigator_agent(nav_prompt)
                return str(agent_res).strip()
            except Exception as e:
                log.warning(f"[Orchestrator] Navigator agent error, falling back to deterministic reply: {e}")

        return self._deterministic_question_reply(sanitized_text, session)

    def _summarize_match_status(self, session: SessionState) -> str:
        if not session.matching_result:
            return "I'm here to help. Could you tell me a little more about your current housing or financial situation?"

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
            return (
                f"I found {len(unverified)} program(s) you might qualify for ({', '.join(names)}), but I still need "
                f"a bit more information to confirm. Let me know more about your situation and I'll check again."
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
                if p.program_id.lower() in q_lower or p.name.lower() in q_lower or ("scrie" in q_lower and "scrie" in p.program_id) or ("drie" in q_lower and "drie" in p.program_id):
                    if p.is_deterministically_eligible is None:
                        replies.append(
                            f"Regarding {p.name}: I cannot confirm eligibility yet -- still need: "
                            f"{'; '.join(p.potential_blockers)}."
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

        # Store the SANITIZED text in history
        session.history.append({"role": "user", "content": sanitized_text or raw_user_message})
        session.history.append({"role": "assistant", "content": reply})  # store pre-rehydration; rehydrate on read if needed

        self.store.save(session)

        return NavigatorResponse(
            session_id=session.session_id,
            reply_message=rehydrated_reply,
            clarification_needed=clarification_needed,
            applicant_profile=session.applicant_profile,
            matching_result=session.matching_result,
            application_draft=session.application_draft,
        )


# Module-level instance
orchestrator = CommunityAidOrchestrator()


def _get_redis_client():
    return orchestrator.store._redis
