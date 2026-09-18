from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from strands import Agent
from server.core.llm import get_model
from server.tools.search_tools import hybrid_search_programs
from server.tools.eligibility_tools import check_program_eligibility
from server.agents.intake_agent import ApplicantProfile


class ProgramMatch(BaseModel):
    program_id: str
    name: str
    organization: str
    category: str
    match_confidence: float = Field(ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    is_deterministically_eligible: Optional[bool] = Field(
        default=None,
        description="True if confirmed eligible, False if disqualified, None if unverifiable (e.g. missing age or disability information)"
    )
    plain_language_reason: str = Field(description="Clear explanation of why this program fits the applicant's situation or what information is needed")
    passed_criteria: List[str]
    potential_blockers: List[str]
    unverifiable_checks: List[str] = Field(default_factory=list)
    application_url: str
    application_method: str


class MatchingResult(BaseModel):
    ranked_programs: List[ProgramMatch]
    total_candidates_evaluated: int
    unmatched_notes: Optional[str] = None


MATCHING_SYSTEM_PROMPT = """
You are the Benefits Matching Specialist for the Community Aid Navigator.

Your objective:
1. Search OpenSearch for relevant aid programs using `hybrid_search_programs`.
2. For each candidate, evaluate their hard eligibility criteria with `check_program_eligibility` (income limits, age, household size, disability rules).
3. Populate `is_deterministically_eligible`:
   - Set to `true` if `check_program_eligibility` returned eligible=True.
   - Set to `false` if `check_program_eligibility` returned eligible=False (disqualified).
   - Set to `null` if `check_program_eligibility` returned eligible=None (applicant is missing required info like age or disability status).
4. If `is_deterministically_eligible` is null, list the missing requirements in `unverifiable_checks` so the applicant can be asked for them.
5. Rank confirmed eligible programs (true) first, followed by potentially eligible programs (null), and explain clearly what criteria passed or what information is needed.
"""


def create_matching_agent() -> Agent:
    model = get_model()
    return Agent(
        name="MatchingAgent",
        system_prompt=MATCHING_SYSTEM_PROMPT,
        tools=[hybrid_search_programs, check_program_eligibility],
        model=model
    )


def match_programs(profile: ApplicantProfile, agent: Optional[Agent] = None) -> MatchingResult:
    """
    Executes the matching pipeline:
    1. If an LLM model is available, the Strands MatchingAgent investigates
       programs using OpenSearch hybrid search and deterministic eligibility checking,
       synthesizing compassionate, personalized explanations.
    2. If offline or on model failure, falls back to deterministic rule execution.
    """
    matcher = agent or create_matching_agent()

    if matcher.model:
        try:
            income_display = f"${profile.annual_income:,.0f}" if profile.annual_income is not None else "Unknown"
            rent_display = f"${profile.monthly_rent:,.0f}" if profile.monthly_rent is not None else "Unknown"
            hh_display = str(profile.household_size) if profile.household_size is not None else "Unknown"
            age_display = str(profile.age) if profile.age is not None else "Unknown"

            prompt = (
                f"Evaluate aid programs for this applicant:\n"
                f"- Location / Borough: {profile.borough or 'NYC'}\n"
                f"- Household Size: {hh_display}\n"
                f"- Annual Income: {income_display}\n"
                f"- Monthly Rent: {rent_display}\n"
                f"- Age: {age_display}\n"
                f"- Disability Benefits: {profile.has_disability_benefits}\n"
                f"- Disability Types: {profile.disability_benefit_types}\n"
                f"- Children Under 5: {profile.has_children_under_5}\n"
                f"- Homeowner: {profile.is_homeowner}\n"
                f"- Primary Needs: {', '.join(profile.primary_needs) if profile.primary_needs else 'Emergency aid'}\n"
                f"- Context Summary: {profile.summary}\n\n"
                f"Instructions:\n"
                f"1. Call `hybrid_search_programs` with tailored keywords based on the applicant's needs and borough.\n"
                f"2. For each candidate returned, call `check_program_eligibility` with the applicant's exact numbers to verify hard rules.\n"
                f"3. Rank the programs (prioritize deterministically eligible programs) and write an empathetic, plain-language reason for each.\n"
                f"4. Return the structured MatchingResult."
            )
            result = matcher(prompt, structured_output_model=MatchingResult)
            if isinstance(result.structured_output, MatchingResult) and result.structured_output.ranked_programs:
                return result.structured_output
        except Exception as e:
            print(f"[MatchingAgent] LLM reasoning fallback to deterministic engine due to: {e}")

    # Deterministic fallback pipeline
    return _deterministic_match_programs(profile)


def _deterministic_match_programs(profile: ApplicantProfile) -> MatchingResult:
    """
    Deterministic fallback for offline mode or API failure.
    Directly queries OpenSearch and checks rules in Python.
    """
    query_terms = list(profile.primary_needs)
    if profile.borough:
        query_terms.append(profile.borough)
    if profile.has_disability_benefits:
        query_terms.append("disability rent assistance")
    if profile.has_children_under_5:
        query_terms.append("childcare headstart prek")
    if profile.is_homeowner:
        query_terms.append("homeowner property tax")

    query_str = " ".join(query_terms) or "emergency community aid nyc"

    candidates = hybrid_search_programs(query=query_str, limit=6)

    matches: List[ProgramMatch] = []
    for cand in candidates:
        pid = cand["program_id"]

        rule_check = check_program_eligibility(
            program_id=pid,
            annual_income=profile.annual_income,
            household_size=profile.household_size,
            age=profile.age,
            region=profile.borough,
            has_disability_benefits=profile.has_disability_benefits,
            disability_benefit_types=profile.disability_benefit_types,
            has_children=profile.has_children_under_5,
            is_homeowner=profile.is_homeowner,
            monthly_rent=profile.monthly_rent
        )

        raw_eligible = rule_check["eligible"]  # True, False, or None
        is_eligible = raw_eligible
        raw_score = cand.get("score", 1.0)

        # Proportional confidence based on eligibility status:
        # - Confirmed eligible: 0.60 to 1.00
        # - Unverifiable / pending info: 0.40 to 0.75
        # - Confirmed ineligible by hard rules: 0.05 to 0.25 (no artificial 40% floor)
        if is_eligible is True:
            confidence = min(1.0, max(0.60, raw_score / 4.0))
        elif is_eligible is None:
            confidence = min(0.75, max(0.40, raw_score / 6.0))
        else:
            confidence = min(0.25, max(0.05, raw_score / 15.0))

        if is_eligible is True:
            reason = f"You qualify based on your reported income and location in {profile.borough or 'NYC'}."
            if profile.has_disability_benefits and "drie" in pid:
                reason = "Your disability benefit makes you eligible for a complete rent freeze under DRIE."
            elif profile.age and profile.age >= 62 and "scrie" in pid:
                reason = "Your age (62+) qualifies you for the SCRIE senior citizen rent freeze."
        elif is_eligible is None:
            unverified_str = "; ".join(rule_check.get("unverifiable_checks", []))
            reason = f"Potentially eligible, but additional verification required: {unverified_str}"
        else:
            reason = f"Not eligible: {'; '.join(rule_check.get('failing_reasons', []))}"

        matches.append(ProgramMatch(
            program_id=pid,
            name=cand["name"],
            organization=cand.get("organization", ""),
            category=cand.get("category", "aid"),
            match_confidence=round(confidence, 2),
            is_deterministically_eligible=is_eligible,
            plain_language_reason=reason,
            passed_criteria=rule_check["passed_checks"],
            potential_blockers=rule_check["failing_reasons"],
            unverifiable_checks=rule_check.get("unverifiable_checks", []),
            application_url=cand.get("application_url", ""),
            application_method=cand.get("application_method", "online")
        ))

    # Sort safely: Confirmed eligible (1) > Unverified (0) > Ineligible (-1), then by confidence
    def _rank_key(m: ProgramMatch):
        elig_rank = 1 if m.is_deterministically_eligible is True else (0 if m.is_deterministically_eligible is None else -1)
        return (elig_rank, m.match_confidence)

    matches.sort(key=_rank_key, reverse=True)

    return MatchingResult(
        ranked_programs=matches,
        total_candidates_evaluated=len(candidates)
    )
