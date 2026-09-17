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
    is_deterministically_eligible: bool
    plain_language_reason: str = Field(description="Clear explanation of why this program fits the applicant's situation")
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
3. Do NOT hallucinate eligibility: If `check_program_eligibility` indicates failing reasons, explain them clearly to the applicant.
4. Rank the confirmed eligible programs by relevance and urgency, providing a compassionate, plain-language explanation of why each one fits.
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
            prompt = (
                f"Evaluate aid programs for this applicant:\n"
                f"- Location / Borough: {profile.borough or 'NYC'}\n"
                f"- Household Size: {profile.household_size if profile.household_size is not None else 'Unknown'}\n"
                f"- Annual Income: ${profile.annual_income:,.0f} if profile.annual_income is not None else 'Unknown'\n"
                f"- Monthly Rent: ${profile.monthly_rent:,.0f} if profile.monthly_rent is not None else 'Unknown'\n"
                f"- Age: {profile.age if profile.age is not None else 'Unknown'}\n"
                f"- Disability Benefits: {profile.has_disability_benefits}\n"
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

        raw_eligible = rule_check["eligible"]
        is_eligible = bool(raw_eligible is True)
        raw_score = cand.get("score", 1.0)
        confidence = min(1.0, max(0.4, (raw_score / 5.0) if is_eligible else (raw_score / 10.0)))

        if is_eligible:
            reason = f"You qualify based on your reported income and location in {profile.borough or 'NYC'}."
            if profile.has_disability_benefits and "drie" in pid:
                reason = "Your disability benefit makes you eligible for a complete rent freeze under DRIE."
            elif profile.age and profile.age >= 62 and "scrie" in pid:
                reason = "Your age (62+) qualifies you for the SCRIE senior citizen rent freeze."
        elif raw_eligible is None:
            reason = f"Potentially eligible, but additional verification required: {'; '.join(rule_check['unverifiable_checks'])}"
        else:
            reason = f"Potential conflict: {'; '.join(rule_check['failing_reasons'])}"

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

    matches.sort(key=lambda m: (m.is_deterministically_eligible, m.match_confidence), reverse=True)

    return MatchingResult(
        ranked_programs=matches,
        total_candidates_evaluated=len(candidates)
    )
