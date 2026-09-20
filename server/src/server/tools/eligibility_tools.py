from typing import Any, Dict, List, Optional
from strands import tool
from opensearchpy import OpenSearch, RequestError, ConnectionError as OSConnectionError

from server.config import settings
from server.core.region_hierarchy import region_matches
from server.core.cedar_gate import cedar_gate


_client: Optional[OpenSearch] = None


def _get_opensearch_client() -> OpenSearch:
    global _client
    if _client is None:
        _client = OpenSearch(
            hosts=[settings.OPENSEARCH_HOST],
            http_compress=True,
            use_ssl=False,
            verify_certs=False,
        )
    return _client


@tool(
    name="check_program_eligibility",
    description="Evaluates hard deterministic qualification rules (income limits, age, household size, disability, region) against a program. Never guesses -- fields that can't be checked are reported as unverifiable, not as passing.",
)
def check_program_eligibility(
    program_id: str,
    principal_id: str = "unknown",
    principal_role: str = "PublicApplicant",
    org_id: Optional[str] = None,
    annual_income: Optional[float] = None,
    household_size: Optional[int] = None,
    age: Optional[int] = None,
    region: Optional[str] = None,
    borough: Optional[str] = None,
    has_disability_benefits: Optional[bool] = None,
    disability_benefit_types: Optional[List[str]] = None,
    has_children: Optional[bool] = None,
    is_homeowner: Optional[bool] = None,
    monthly_rent: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Evaluates hard-coded deterministic rules -- no LLM judgment involved.

    Args:
        program_id: ID of the program (e.g. 'nyc-drie-001').
        principal_id: Real identifier of the requesting session/user, for Cedar.
        principal_role: Role of the principal making the request.
        org_id: Organization ID of the principal, if a Caseworker.
        annual_income: Applicant's estimated annual household income.
        household_size: Total count of household members.
        age: Age of the primary applicant.
        region: Applicant's region/borough of residence.
        has_disability_benefits: True if receiving a qualifying disability benefit.
        disability_benefit_types: Specific benefits held, e.g. ['SSI', 'SSDI'] --
            checked against the program's required_benefits_any list if present.
        has_children: True if applicant has qualifying children/dependents.
        is_homeowner: True if applicant owns their home.
        monthly_rent: Monthly rent paid by the household.

    Returns:
        Dictionary with:
          'eligible': True / False / None (None = can't determine yet)
          'program_name': str
          'passed_checks': list of rules verified as met
          'failing_reasons': list of rules verified as NOT met
          'unverifiable_checks': list of rules that apply but couldn't be
              checked because the needed applicant field wasn't provided
          'rules_need_review': True if the program's own eligibility_rules
              were auto-inferred and not yet confirmed by a human -- treat
              the whole result cautiously if so.
    """
    principal = {"id": principal_id, "role": principal_role, "orgId": org_id}
    resource = {"type": "AidPrograms", "id": program_id}
    if not cedar_gate.is_authorized(principal=principal, action="checkEligibility", resource=resource):
        raise PermissionError(f"Cedar Policy Denied: Action 'checkEligibility' is forbidden for role '{principal_role}'")

    client = _get_opensearch_client()
    try:
        doc = client.get(index=settings.OPENSEARCH_INDEX_PROGRAMS, id=program_id)
    except (OSConnectionError, RequestError, Exception) as e:
        return {
            "eligible": None,
            "program_id": program_id,
            "program_name": program_id,
            "passed_checks": [],
            "failing_reasons": [],
            "unverifiable_checks": [f"Could not look up program '{program_id}': {e}"],
            "rules_need_review": True,
        }

    src = doc["_source"]
    rules = src.get("eligibility_rules", {})
    program_name = src.get("name", program_id)
    rules_need_review = bool(rules.get("needs_review", False))

    program_region = str(src.get("region", "")).lower()
    if "india" in program_region or program_id.startswith("in-"):
        curr_sym = "₹"
    elif "uk" in program_region or program_id.startswith("uk-"):
        curr_sym = "£"
    elif "canada" in program_region or program_id.startswith("ca-"):
        curr_sym = "CA$"
    else:
        curr_sym = "$"

    failing_reasons: List[str] = []
    passed_checks: List[str] = []
    unverifiable_checks: List[str] = []

    effective_region = region or borough

    # 1. Closed status -- this one is always knowable, no applicant field needed
    if rules.get("applications_open") is False:
        failing_reasons.append("Applications are currently closed for this program.")

    # 2. Region / allowed_regions
    allowed_regions = rules.get("allowed_regions")
    if allowed_regions:
        if effective_region is None:
            unverifiable_checks.append("Program has a region restriction, but applicant's region was not provided.")
        elif not region_matches(effective_region, allowed_regions):
            failing_reasons.append(f"Applicant's region '{effective_region}' is not within the program's allowed regions {allowed_regions}.")
        else:
            passed_checks.append(f"Applicant's region '{effective_region}' is within the program's allowed regions {allowed_regions}.")
    
    # 3. Income limit
    max_income = rules.get("max_annual_income")
    if max_income is not None:
        if annual_income is None:
            unverifiable_checks.append("Program has an income cap, but applicant's income was not provided.")
        elif annual_income > max_income:
            failing_reasons.append(f"Income {curr_sym}{annual_income:,.0f} exceeds maximum threshold of {curr_sym}{max_income:,.0f}.")
        else:
            passed_checks.append(f"Income {curr_sym}{annual_income:,.0f} is within limit of {curr_sym}{max_income:,.0f}.")

    # 4. Minimum age
    min_age = rules.get("min_age")
    if min_age is not None:
        if age is None:
            unverifiable_checks.append(f"Program requires minimum age {min_age}, but applicant's age was not provided.")
        elif age < min_age:
            failing_reasons.append(f"Age {age} is below required minimum of {min_age}.")
        else:
            passed_checks.append(f"Age {age} meets minimum requirement of {min_age}.")

    # 5. Maximum age
    max_age = rules.get("max_age")
    if max_age is not None:
        if age is None:
            unverifiable_checks.append(f"Program has a maximum age of {max_age}, but applicant's age was not provided.")
        elif age > max_age:
            failing_reasons.append(f"Age {age} exceeds maximum age limit of {max_age}.")
        else:
            passed_checks.append(f"Age {age} is within eligible age limit of {max_age}.")

    # 6. Household size (min/max)
    min_hh = rules.get("min_household_size")
    if min_hh is not None and min_hh > 1:  # min of 1 is trivially true, don't bother flagging
        if household_size is None:
            unverifiable_checks.append(f"Program requires household size >= {min_hh}, but household size was not provided.")
        elif household_size < min_hh:
            failing_reasons.append(f"Household size {household_size} is below required minimum of {min_hh}.")
        else:
            passed_checks.append(f"Household size {household_size} meets requirement.")

    max_hh = rules.get("max_household_size")
    if max_hh is not None:
        if household_size is None:
            unverifiable_checks.append(f"Program caps household size at {max_hh}, but household size was not provided.")
        elif household_size > max_hh:
            failing_reasons.append(f"Household size {household_size} exceeds maximum of {max_hh}.")
        else:
            passed_checks.append(f"Household size {household_size} is within the maximum of {max_hh}.")

    # 7. Disability benefits, including specific required types
    if rules.get("requires_disability_benefit"):
        required_types = rules.get("required_benefits_any") or []
        if has_disability_benefits is None:
            unverifiable_checks.append("Program requires a qualifying disability benefit, but this was not provided.")
        elif has_disability_benefits is False:
            failing_reasons.append("Requires receiving a qualifying disability benefit (e.g. SSI, SSDI, VA disability).")
        elif required_types:
            if disability_benefit_types is None:
                unverifiable_checks.append(
                    f"Program requires one of {required_types}, but applicant's specific benefit type was not provided."
                )
            elif not any(bt.upper() in [t.upper() for t in required_types] for bt in disability_benefit_types):
                failing_reasons.append(
                    f"Applicant's disability benefit(s) {disability_benefit_types} do not match the program's required list {required_types}."
                )
            else:
                passed_checks.append(f"Applicant's disability benefit matches a required type ({required_types}).")
        else:
            passed_checks.append("Receives a qualifying disability benefit.")

    # 8. Children requirement
    if rules.get("requires_children"):
        if has_children is None:
            unverifiable_checks.append("Program requires qualifying children/dependents, but this was not provided.")
        elif has_children is False:
            failing_reasons.append("Program requires raising qualifying children or dependents.")
        else:
            passed_checks.append("Household includes qualifying children.")

    # 9. Homeowner requirement
    if rules.get("requires_homeowner"):
        if is_homeowner is None:
            unverifiable_checks.append("Program is homeowner-only, but homeownership status was not provided.")
        elif is_homeowner is False:
            failing_reasons.append("Program is strictly for homeowners of a primary residence.")
        else:
            passed_checks.append("Applicant owns and lives in their primary residence.")

    # 10. Rent burden (e.g. rent > 1/3 income)
    min_rent_ratio = rules.get("min_rent_income_ratio")
    if min_rent_ratio is not None:
        if monthly_rent is None or annual_income is None or annual_income <= 0:
            unverifiable_checks.append(
                "Program requires a minimum rent-to-income ratio, but rent and/or income were not provided."
            )
        else:
            annual_rent = monthly_rent * 12
            actual_ratio = annual_rent / annual_income
            if actual_ratio < min_rent_ratio:
                failing_reasons.append(f"Rent-to-income ratio ({actual_ratio:.1%}) is below the {min_rent_ratio:.1%} threshold.")
            else:
                passed_checks.append(f"Rent-to-income ratio ({actual_ratio:.1%}) qualifies for rent burden assistance.")

    # Final determination -- three states, not two:
    #   False -> at least one rule was checked and failed
    #   None  -> nothing failed, but at least one applicable rule couldn't be checked
    #   True  -> every applicable rule was checked, and all passed
    if failing_reasons:
        is_eligible: Optional[bool] = False
    elif unverifiable_checks:
        is_eligible = None
    else:
        is_eligible = True

    return {
        "eligible": is_eligible,
        "is_eligible": is_eligible,
        "program_id": program_id,
        "program_name": program_name,
        "passed_checks": passed_checks,
        "passed_criteria": passed_checks,
        "failing_reasons": failing_reasons,
        "failing_criteria": failing_reasons,
        "reasons": failing_reasons,
        "unverifiable_checks": unverifiable_checks,
        "rules_need_review": rules_need_review,
    }