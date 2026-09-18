from typing import List, Optional
from pydantic import BaseModel, Field
from strands import Agent
from server.core.llm import get_model


class ApplicantProfile(BaseModel):
    preferred_language: str = Field(default="en", description="Detected language code, e.g. 'en'")
    borough: Optional[str] = Field(default=None, description="Borough or city (e.g. 'brooklyn', 'bronx', 'queens', 'manhattan', 'staten island')")
    household_size: Optional[int] = Field(default=None, description="Total number of members in the household. None means unknown/unverified.")
    annual_income: Optional[float] = Field(default=None, description="Estimated total annual household income in dollars")
    monthly_rent: Optional[float] = Field(default=None, description="Monthly rent paid if applicable")
    age: Optional[int] = Field(default=None, description="Age of the primary applicant if mentioned")
    has_disability_benefits: Optional[bool] = Field(default=None, description="Receives SSI, SSDI, or VA disability benefits")
    disability_benefit_types: Optional[List[str]] = Field(default=None, description="Specific benefit types e.g. ['SSI', 'SSDI', 'VA_DISABILITY']")
    has_children_under_5: Optional[bool] = Field(default=None, description="Has young children specifically under age 5 (for Pre-K/Head Start)")
    is_homeowner: Optional[bool] = Field(default=None, description="Owns their home (primary residence)")
    primary_needs: List[str] = Field(default_factory=list, description="Immediate needs e.g. ['housing', 'food', 'childcare', 'cash']")
    missing_critical_fields: List[str] = Field(default_factory=list, description="List of essential fields that could not be determined")
    clarification_question: Optional[str] = Field(default=None, description="Empathetic follow-up question if essential information is missing")
    summary: str = Field(default="Applicant seeking assistance", description="One-sentence objective summary of the applicant's current situation")


INTAKE_SYSTEM_PROMPT = """
You are an empathetic, highly skilled Community Aid Intake Specialist for the Community Aid Navigator.

Your role is to understand the applicant's situation from their message and extract their structured profile.

Guidelines:
1. FACT-EXTRACTION ONLY: Never make final eligibility decisions. Your job is purely to extract facts.
2. CRITICAL vs OPTIONAL FIELDS:
   - The ONLY critical fields required before matching can proceed are `borough` (location) and `annual_income`.
   - Fields like `age`, `household_size`, `monthly_rent`, `has_disability_benefits`, `has_children_under_5`, and `is_homeowner` are OPTIONAL specifics. If not mentioned in the message, set them to null.
3. CLARIFICATION LOOP: Only populate `clarification_question` and `missing_critical_fields` if the user gave NO indication of their location/borough or their income.
4. SANITIZED DATA: You may see placeholders like <PERSON_1> or <PHONE_1> due to privacy de-identification. Treat them naturally as proper nouns.
"""


def create_intake_agent() -> Agent:
    model = get_model()
    return Agent(
        name="IntakeAgent",
        system_prompt=INTAKE_SYSTEM_PROMPT,
        model=model
    )


def extract_profile(
    user_text: str,
    agent: Optional[Agent] = None,
    preferred_language: str = "en",
) -> ApplicantProfile:
    """
    Extracts structured applicant profile from message text using Strands structured output.

    `preferred_language` should come from the upstream Comprehend language-detection step,
    not be re-inferred here -- avoids two components disagreeing about the user's language.
    """
    intake = agent or create_intake_agent()

    # If a live model is configured, use Strands structured output
    if intake.model:
        try:
            result = intake(
                user_text,
                structured_output_model=ApplicantProfile
            )
            if isinstance(result.structured_output, ApplicantProfile):
                profile = result.structured_output
                profile.preferred_language = preferred_language
                return profile
            elif result.structured_output is not None:
                print(f"[Warning] Unexpected structured_output type from IntakeAgent: {type(result.structured_output)}. Falling back to heuristic extraction.")
        except Exception as e:
            print(f"[IntakeAgent] Model execution throttled or unavailable ({e}). Falling back to heuristic extraction.")

    # Robust heuristic fallback for offline testing / zero API key mode
    return _heuristic_extract(user_text, preferred_language=preferred_language)


def _heuristic_extract(user_text: str, preferred_language: str = "en") -> ApplicantProfile:
    import re

    text_lower = user_text.lower()

    # Borough detection
    borough = None
    for b in ["brooklyn", "bronx", "queens", "manhattan", "staten island"]:
        if b in text_lower:
            borough = b
            break

    # Income detection
    income = None
    inc_match = (
        re.search(r"\$([0-9,]+)", user_text)
        or re.search(r"([0-9]{2,3})k\b", text_lower)
        or re.search(r"(?:income|earn|make|salary|making|earning|earns|makes)(?:\s+is|\s+of)?\s*\$?([0-9,]+)", text_lower)
        or re.search(r"\b([0-9]{4,6})\s*(?:a year|per year|annual|annually)\b", text_lower)
    )
    if inc_match:
        val_str = inc_match.group(1).replace(",", "")
        try:
            income = float(val_str) * (1000 if "k" in inc_match.group(0).lower() else 1)
        except ValueError:
            pass

    # Monthly rent detection -- keyword-anchored so it doesn't grab an
    # unrelated dollar figure (e.g. income) that happens to appear first.
    rent = None
    rent_match = (
        re.search(r"\$([0-9,]+)\s*(?:per month|/month|monthly)", text_lower)
        or re.search(r"rent(?:\s+is|\s+of)?\s*\$?([0-9,]+)", text_lower)
        or re.search(r"pay\s*\$?([0-9,]+)\s*(?:for|in)?\s*rent", text_lower)
    )
    if rent_match:
        rent_str = rent_match.group(1).replace(",", "")
        try:
            rent = float(rent_str)
        except ValueError:
            pass

    # Age detection
    age = None
    age_match = (
        re.search(r"\bage(?:\s+is)?\s+(\d{1,2})\b", text_lower)
        or re.search(r"\bi'?m\s+(\d{1,2})\s*(?:years?\s*old)?\b", text_lower)
        or re.search(r"\bi am\s+(\d{1,2})\s*(?:years?\s*old)?\b", text_lower)
    )
    if age_match:
        try:
            age = int(age_match.group(1))
        except ValueError:
            pass

    # Household size detection
    household_size = None
    if any(w in text_lower for w in ["live alone", "single person", "just me", "by myself"]):
        household_size = 1
    else:
        hh_match = (
            re.search(r"\b(\d{1,2})\s*(?:people|person|members?)\s+in\s+(?:my|the)\s+household\b", text_lower)
            or re.search(r"\bhousehold\s+of\s+(\d{1,2})\b", text_lower)
            or re.search(r"\bfamily\s+of\s+(\d{1,2})\b", text_lower)
        )
        if hh_match:
            try:
                household_size = int(hh_match.group(1))
            except ValueError:
                pass

    # Needs
    needs = []
    if any(w in text_lower for w in ["rent", "housing", "eviction", "shelter"]):
        needs.append("housing")
    if any(w in text_lower for w in ["food", "snap", "groceries", "hungry"]):
        needs.append("food")
    if any(w in text_lower for w in ["child", "pre-k", "daycare", "head start"]):
        needs.append("childcare")
    if any(w in text_lower for w in ["cash", "money", "income"]):
        needs.append("financial")

    # Disability detection (supporting 3-state: True, False, None)
    if any(w in text_lower for w in ["no disability", "not disabled", "no disabilities", "don't have disability", "dont have disability"]):
        disability = False
    elif any(w in text_lower for w in ["disability", "disabled", "ssi", "ssdi", "va disability"]):
        disability = True
    else:
        disability = None

    benefit_types = []
    if "ssi" in text_lower:
        benefit_types.append("SSI")
    if "ssdi" in text_lower:
        benefit_types.append("SSDI")
    if "va disability" in text_lower or "va" in text_lower:
        benefit_types.append("VA_DISABILITY")
    homeowner = ("homeowner" in text_lower or "own my home" in text_lower) or None

    # Children under 5 detection
    has_children_under_5 = None
    mentions_child = any(w in text_lower for w in ["child", "kid", "son", "daughter"])
    young_child_signal = any(w in text_lower for w in ["pre-k", "head start", "toddler", "infant", "baby", "daycare"])
    young_age_match = re.search(r"\b(?:my (?:son|daughter|child) is)\s+(\d{1,2})\b", text_lower)
    young_age_under_5 = bool(young_age_match) and int(young_age_match.group(1)) < 5
    if mentions_child:
        has_children_under_5 = young_child_signal or young_age_under_5 or None

    # Determine missing critical fields and generate clarification question if needed
    missing_critical_fields = []
    if not income:
        missing_critical_fields.append("income")
    if not borough:
        missing_critical_fields.append("borough")

    if missing_critical_fields:
        if len(missing_critical_fields) == 2:
            clarification_question = "Could you share which NYC borough you live in and your approximate annual income so we can find exact matching aid?"
        elif "income" in missing_critical_fields:
            clarification_question = "Could you share your approximate annual household income so we can find exact matching aid?"
        else:
            clarification_question = "Could you share which NYC borough you live in so we can find exact matching aid?"
    else:
        clarification_question = None

    return ApplicantProfile(
        preferred_language=preferred_language,
        borough=borough,
        household_size=household_size,
        annual_income=income,
        monthly_rent=rent,
        age=age,
        has_disability_benefits=disability,
        disability_benefit_types=benefit_types or None,
        has_children_under_5=has_children_under_5,
        is_homeowner=homeowner,
        primary_needs=needs or ["general"],
        missing_critical_fields=missing_critical_fields,
        clarification_question=clarification_question,
        summary=f"Applicant seeking assistance with {', '.join(needs) if needs else 'community aid'}."
    )