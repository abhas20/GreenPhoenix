import re
from typing import List, Optional
from pydantic import BaseModel, Field
from strands import Agent
from server.core.llm import get_model, get_fast_retry_strategy


class ApplicantProfile(BaseModel):
    preferred_language: str = Field(default="en", description="Detected language code, e.g. 'en'")
    country: Optional[str] = Field(default=None, description="Country of residence, e.g. 'India', 'United States', 'United Kingdom', 'Canada'")
    state_province: Optional[str] = Field(default=None, description="State, province, or territory, e.g. 'Maharashtra', 'Karnataka', 'New York'")
    city_district: Optional[str] = Field(default=None, description="City, district, or municipality, e.g. 'Mumbai', 'Bengaluru', 'Brooklyn'")
    borough: Optional[str] = Field(default=None, description="Borough or city for NYC/local compatibility (e.g. 'brooklyn', 'bronx', 'queens', 'manhattan', 'staten island', 'mumbai', 'delhi')")
    currency: str = Field(default="USD", description="Currency code or symbol (e.g. 'USD', 'INR', 'GBP', 'EUR')")
    household_size: Optional[int] = Field(default=None, description="Total number of members in the household. None means unknown/unverified.")
    annual_income: Optional[float] = Field(default=None, description="Estimated total annual household income in dollars or local currency units")
    monthly_rent: Optional[float] = Field(default=None, description="Monthly rent or housing cost paid if applicable")
    age: Optional[int] = Field(default=None, description="Age of the primary applicant if mentioned")
    has_disability_benefits: Optional[bool] = Field(default=None, description="Receives disability benefits or holds a certified disability card (e.g. SSI, SSDI, UDID, PwD card)")
    disability_benefit_types: Optional[List[str]] = Field(default=None, description="Specific benefit types e.g. ['SSI', 'SSDI', 'VA_DISABILITY', 'UDID']")
    has_children_under_5: Optional[bool] = Field(default=None, description="Has young children specifically under age 5 (for Pre-K/Head Start/nutrition schemes)")
    is_homeowner: Optional[bool] = Field(default=None, description="Owns their home (primary residence)")
    primary_needs: List[str] = Field(default_factory=list, description="Immediate needs e.g. ['housing', 'food', 'financial', 'childcare', 'health', 'utilities']")
    missing_critical_fields: List[str] = Field(default_factory=list, description="List of essential fields that could not be determined")
    clarification_question: Optional[str] = Field(default=None, description="Empathetic follow-up question if essential information is missing")
    summary: str = Field(default="Applicant seeking assistance", description="One-sentence objective summary of the applicant's current situation")


INTAKE_SYSTEM_PROMPT = """
You are an empathetic, highly skilled Global Community Aid Intake Specialist for the Community Aid Navigator.

Your role is to understand the applicant's situation from their message and extract their structured profile.
You support applicants from ANY country worldwide, with comprehensive knowledge of social safety net systems in India, the United States, the UK, Canada, and global aid frameworks.

Guidelines:
1. FACT-EXTRACTION ONLY: Never make final eligibility decisions or promise approvals. Your job is purely to extract facts.
2. GLOBAL LOCATION & GEOGRAPHY:
   - Extract `country`, `state_province`, and `city_district`.
   - If the applicant is in India, recognize Indian states (e.g. Maharashtra, Karnataka, Delhi, UP, Tamil Nadu, West Bengal) and cities (e.g. Mumbai, Bengaluru, Delhi, Kolkata, Chennai, Hyderabad). Set `country = 'India'` and populate `state_province` / `city_district`. Also set `borough` to the city or state for compatibility.
   - If the applicant is in NYC / United States, recognize NYC boroughs (brooklyn, bronx, queens, manhattan, staten island) or 'nyc'. Set `country = 'United States'` and `borough` to the borough name.
   - If location is not specified, leave country/state/city as null.
3. MULTI-CURRENCY & INCOME EXTRACTION:
   - Identify the currency: 'INR' (₹, Rupees, Lakhs), 'USD' ($), 'GBP' (£), 'EUR' (€). Default to 'INR' if in India, 'USD' if in US.
   - Indian Lakhs: Convert lakhs to standard numerical units (e.g. 2.5 Lakh = 250000, 3 Lakh = 300000, 1 Lakh = 100000).
   - Zero Income / Unemployment: If the applicant states they have no income, lost their job, are unemployed with no income, or make 0, set `annual_income = 0.0`. Do NOT mark income as missing.
   - Frequency Annualization: If income is given weekly ($X/week or ₹X/week) or monthly, annualize it ($X * 52 or $X * 12).
4. PRIMARY NEEDS:
   - Always extract immediate aid needs into `primary_needs` (e.g. ['food', 'housing', 'financial', 'health', 'childcare', 'utilities']).
5. CLARIFICATION & MISSING FIELDS:
   - Only populate `missing_critical_fields` and `clarification_question` if the applicant gave NO actionable context whatsoever (e.g. just 'hi' or 'help' without location or needs).
   - If the applicant stated an aid need (e.g. food, rent, eviction, medical help, farmer grant), do NOT block matching—leave `missing_critical_fields` empty and `clarification_question` as null so the matching agent can surface preliminary aid right away.
6. SANITIZED DATA:
   - You may see privacy placeholders like <PERSON_1> or <PHONE_1>. Treat them naturally as proper nouns.
"""


def create_intake_agent() -> Agent:
    model = get_model()
    return Agent(
        name="IntakeAgent",
        system_prompt=INTAKE_SYSTEM_PROMPT,
        model=model,
        retry_strategy=get_fast_retry_strategy(max_attempts=2),
    )


def extract_profile(
    user_text: str,
    agent: Optional[Agent] = None,
    preferred_language: str = "en",
) -> ApplicantProfile:
    """
    Extracts structured applicant profile from message text using Strands structured output.
    """
    intake = agent or create_intake_agent()

    if intake.model:
        try:
            result = intake(
                user_text,
                structured_output_model=ApplicantProfile
            )
            if isinstance(result.structured_output, ApplicantProfile):
                profile = result.structured_output
                profile.preferred_language = preferred_language
                # Ensure compatibility between city_district and borough
                if not profile.borough and profile.city_district:
                    profile.borough = profile.city_district.lower()
                return profile
            elif result.structured_output is not None:
                print(f"[Warning] Unexpected structured_output type from IntakeAgent: {type(result.structured_output)}. Falling back to heuristic extraction.")
        except Exception as e:
            print(f"[IntakeAgent] Model execution throttled or unavailable ({e}). Falling back to heuristic extraction.")

    # Robust heuristic fallback for offline testing / zero API key mode
    return _heuristic_extract(user_text, preferred_language=preferred_language)


def _heuristic_extract(user_text: str, preferred_language: str = "en") -> ApplicantProfile:
    text_lower = user_text.lower()

    # 1. Location Detection (Global & NYC)
    country = None
    state_province = None
    city_district = None
    borough = None

    # Check India
    if any(w in text_lower for w in ["india", "bharat", "delhi", "mumbai", "bengaluru", "bangalore", "kolkata", "chennai", "hyderabad", "pune", "maharashtra", "karnataka", "tamil nadu", "uttar pradesh"]):
        country = "India"
        if "maharashtra" in text_lower or "mumbai" in text_lower or "pune" in text_lower:
            state_province = "Maharashtra"
            city_district = "Mumbai" if "mumbai" in text_lower else ("Pune" if "pune" in text_lower else None)
        elif "karnataka" in text_lower or "bengaluru" in text_lower or "bangalore" in text_lower:
            state_province = "Karnataka"
            city_district = "Bengaluru"
        elif "delhi" in text_lower:
            state_province = "Delhi"
            city_district = "New Delhi"
        borough = (city_district or state_province or "india").lower()

    # Check NYC / US
    if not borough:
        for b in ["brooklyn", "bronx", "queens", "manhattan", "staten island"]:
            if b in text_lower:
                borough = b
                city_district = b.title()
                state_province = "New York"
                country = "United States"
                break

    if not borough and any(w in text_lower for w in ["nyc", "new york city", "new york"]):
        borough = "nyc"
        state_province = "New York"
        country = "United States"

    # Neighborhoods
    neighborhood_map = {
        "harlem": ("manhattan", "New York", "United States"),
        "astoria": ("queens", "New York", "United States"),
        "flushing": ("queens", "New York", "United States"),
        "bushwick": ("brooklyn", "New York", "United States"),
        "bed-stuy": ("brooklyn", "New York", "United States"),
        "crown heights": ("brooklyn", "New York", "United States"),
        "south bronx": ("bronx", "New York", "United States"),
    }
    if not borough:
        for n, (b, st, c) in neighborhood_map.items():
            if n in text_lower:
                borough = b
                city_district = b.title()
                state_province = st
                country = c
                break

    # 2. Currency & Income detection
    currency = "INR" if country == "India" or "₹" in user_text or "rupee" in text_lower or "lakh" in text_lower else "USD"
    income = None

    # Zero income / job loss check first
    if any(w in text_lower for w in ["no income", "zero income", "without income", "lost my job", "unemployed", "have no job", "no money right now"]):
        income = 0.0

    # Indian Lakhs check: e.g. 2.5 lakh, 3 lakhs, ₹2.5lakh
    if income is None:
        lakh_match = re.search(r"(?:₹|rs\.?|inr)?\s*([0-9.]+)\s*(?:lakh|lac)s?", text_lower)
        if lakh_match:
            try:
                income = float(lakh_match.group(1)) * 100000.0
            except ValueError:
                pass

    # Standard income pattern
    if income is None:
        inc_match = (
            re.search(r"[\$₹£€]([0-9,]+)", user_text)
            or re.search(r"([0-9]{2,3})k\b", text_lower)
            or re.search(r"(?:income|earn|make|salary|earning|earns|makes)(?:\s+is|\s+of)?\s*[\$₹£€]?\s*([0-9,]+)", text_lower)
            or re.search(r"\b([0-9]{4,7})\s*(?:a year|per year|annual|annually)\b", text_lower)
        )
        if inc_match:
            val_str = inc_match.group(1).replace(",", "")
            try:
                income = float(val_str) * (1000 if "k" in inc_match.group(0).lower() else 1)
            except ValueError:
                pass

    # Weekly / monthly annualization
    if income is None:
        weekly_match = re.search(r"[\$₹£€]?\s*([0-9,]+)\s*(?:a week|/week|per week|weekly)", text_lower)
        if weekly_match:
            try:
                income = float(weekly_match.group(1).replace(",", "")) * 52.0
            except ValueError:
                pass

    # 3. Monthly rent
    rent = None
    rent_match = (
        re.search(r"[\$₹£€]([0-9,]+)\s*(?:per month|/month|monthly)", text_lower)
        or re.search(r"rent(?:\s+is|\s+of)?\s*[\$₹£€]?\s*([0-9,]+)", text_lower)
        or re.search(r"pay\s*[\$₹£€]?\s*([0-9,]+)\s*(?:for|in)?\s*rent", text_lower)
    )
    if rent_match:
        rent_str = rent_match.group(1).replace(",", "")
        try:
            rent = float(rent_str)
        except ValueError:
            pass

    # 4. Age
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

    # 5. Household size
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

    # 6. Primary Needs
    needs = []
    if any(w in text_lower for w in ["rent", "housing", "eviction", "shelter", "house", "awas"]):
        needs.append("housing")
    if any(w in text_lower for w in ["food", "snap", "groceries", "hungry", "ration", "pds", "ration card"]):
        needs.append("food")
    if any(w in text_lower for w in ["child", "pre-k", "daycare", "head start", "children"]):
        needs.append("childcare")
    if any(w in text_lower for w in ["health", "hospital", "doctor", "medical", "treatment", "ayushman", "medicine"]):
        needs.append("health")
    if any(w in text_lower for w in ["cash", "money", "income", "job", "employment", "kisan", "farmer", "pension", "mgnrega", "vendor", "svanidhi"]):
        needs.append("financial")

    # 7. Disability
    if any(w in text_lower for w in ["no disability", "not disabled", "no disabilities", "don't have disability", "dont have disability"]):
        disability = False
    elif any(w in text_lower for w in ["disability", "disabled", "ssi", "ssdi", "va disability", "udid", "divyang"]):
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
    if "udid" in text_lower or "divyang" in text_lower:
        benefit_types.append("UDID")
    homeowner = ("homeowner" in text_lower or "own my home" in text_lower or "own a home" in text_lower) or None

    # 8. Children under 5
    has_children_under_5 = None
    mentions_child = any(w in text_lower for w in ["child", "kid", "son", "daughter"])
    young_child_signal = any(w in text_lower for w in ["pre-k", "head start", "toddler", "infant", "baby", "daycare"])
    young_age_match = re.search(r"\b(?:my (?:son|daughter|child) is)\s+(\d{1,2})\b", text_lower)
    young_age_under_5 = bool(young_age_match) and int(young_age_match.group(1)) < 5
    if mentions_child:
        has_children_under_5 = young_child_signal or young_age_under_5 or None

    # 9. Missing critical fields evaluation
    missing_critical_fields = []
    # If the user provided no income AND no location AND no matching needs were provided (or just a partial greeting)
    if income is None:
        missing_critical_fields.append("income")
    if not borough:
        missing_critical_fields.append("borough")

    if missing_critical_fields:
        if len(missing_critical_fields) == 2:
            clarification_question = "Could you share which country and city/borough you live in, and your approximate household income so we can find exact matching aid?"
        elif "income" in missing_critical_fields:
            clarification_question = "Could you share your approximate annual household income so we can find exact matching aid?"
        else:
            clarification_question = "Could you share which country and city or borough you live in so we can find exact matching aid?"
    else:
        clarification_question = None

    return ApplicantProfile(
        preferred_language=preferred_language,
        country=country,
        state_province=state_province,
        city_district=city_district,
        borough=borough,
        currency=currency,
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