from typing import Any, Dict, List, Optional, Tuple
import re

TRUE_STRINGS = {"true", "yes", "1", "y"}
FALSE_STRINGS = {"false", "no", "0", "n", ""}


def _parse_bool(value: Optional[str]) -> Optional[bool]:
    """Returns None (unset) rather than guessing when the value is ambiguous."""
    if value is None:
        return None
    v = str(value).strip().lower()
    if v in TRUE_STRINGS:
        return True
    if v in FALSE_STRINGS:
        return False
    return None


def _parse_int(value: Optional[str]) -> Optional[int]:
    v = str(value).strip() if value is not None else ""
    if not v:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def _parse_float(value: Optional[str]) -> Optional[float]:
    v = str(value).strip() if value is not None else ""
    if not v:
        return None
    try:
        return float(v.replace(",", "").replace("$", ""))
    except ValueError:
        return None


def _parse_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in str(value).split(";") if item.strip()]


def _infer_income_caps(text: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Infers (single_cap, family_max_cap) from income text when explicit column is missing.
    Returns (None, None) if 'no income requirement' or no dollar figures are found.
    """
    if "no income requirement" in text:
        return None, None
    matches = re.findall(r"\$([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})", text)
    if not matches:
        return None, None
    nums = sorted(list(set(float(m.replace(",", "")) for m in matches)))
    if len(nums) == 1:
        return nums[0], nums[0]
    # For tiered brackets (e.g. single $19,104 vs family $68,675)
    return nums[0], nums[-1]


def parse_deterministic_rules(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builds the structured eligibility_rules object for one CSV row.
    
    1. Directly utilizes explicit CSV columns (e.g. eligible_household_size_min/max, region).
    2. Checks for explicit future columns (e.g. max_annual_income, min_age, requires_disability).
    3. Falls back to text inference from (income_threshold, other_eligibility_notes, description, category).
    4. Explicitly tracks auditability with 'needs_review' and 'inferred_fields' for full transparency.
    """
    region = str(row.get("region", "nyc") or "nyc").strip().lower()
    notes = str(row.get("other_eligibility_notes", "") or "").strip().lower()
    income_str = str(row.get("income_threshold", "") or "").strip().lower()
    desc = str(row.get("description", "") or "").strip().lower()
    category = str(row.get("category", "") or "").strip().lower()
    name = str(row.get("name", "") or "").strip().lower()

    full_text = f"{name} {desc} {notes} {income_str} {category}"

    needs_review = False
    inferred_fields: List[str] = []

    # 1. Household size (explicit in CSV schema: eligible_household_size_min/max)
    min_hh = _parse_int(row.get("eligible_household_size_min")) or 1
    max_hh = _parse_int(row.get("eligible_household_size_max"))

    # 2. Income cap
    if "max_annual_income" in row and str(row.get("max_annual_income", "")).strip():
        max_income = _parse_float(row.get("max_annual_income"))
    else:
        single_cap, family_cap = _infer_income_caps(income_str + " " + notes)
        max_income = family_cap
        if max_income is not None:
            needs_review = True
            inferred_fields.append("max_annual_income (inferred from income_threshold/notes)")

    # 3. Age bounds
    if "min_age" in row and str(row.get("min_age", "")).strip():
        min_age = _parse_int(row.get("min_age"))
    else:
        senior_match = (
            re.search(r"\b(?:age|aged|seniors?)\s+(\d{2})\+", notes) or
            re.search(r"\b(\d{2})\+\b", notes) or
            re.search(r"\b(?:age|aged|seniors?)\s+(\d{2})\+", desc)
        )
        min_age = int(senior_match.group(1)) if senior_match else None
        if min_age is not None:
            needs_review = True
            inferred_fields.append("min_age (inferred from notes/description)")

    if "max_age" in row and str(row.get("max_age", "")).strip():
        max_age = _parse_int(row.get("max_age"))
    else:
        max_age = None
        if "age 5 and under" in full_text or "under 5" in full_text:
            max_age = 5
            needs_review = True
            inferred_fields.append("max_age (inferred as 5 from text)")
        elif "four-year-olds" in full_text or "pre-k" in name or "pre-k" in desc:
            min_age = 4
            max_age = 4
            needs_review = True
            inferred_fields.append("age_bracket (inferred 4-year-old Pre-K)")

    # 4. Helper for boolean requirement flags (explicit column first, heuristic fallback)
    def _resolve_bool(col: str, keyword_detected: bool, field_label: str) -> bool:
        nonlocal needs_review, inferred_fields
        if col in row and row[col] is not None and str(row[col]).strip() != "":
            parsed = _parse_bool(str(row[col]))
            if parsed is not None:
                return parsed
        if keyword_detected:
            needs_review = True
            inferred_fields.append(f"{col} ({field_label})")
            return True
        return False

    req_disability = _resolve_bool(
        "requires_disability_benefit",
        any(k in full_text for k in ["disability benefit", "disability medicaid", "ssi", "ssdi", "va disability"]),
        "inferred from disability/SSI mentions"
    )

    req_children = _resolve_bool(
        "requires_children",
        bool(
            category == "childcare" or
            "with children" in full_text or
            "raising children" in full_text or
            "head start" in full_text or
            "pre-k" in full_text or
            "afterschool" in full_text or
            (max_age is not None and max_age <= 18)
        ),
        "inferred from children/childcare keywords"
    )

    req_homeowner = _resolve_bool(
        "requires_homeowner",
        any(k in full_text for k in ["homeowner", "own and live in the home", "property tax"]),
        "inferred from homeowner/property tax mentions"
    )

    req_rent_burden = _resolve_bool(
        "requires_rent_burden",
        any(k in full_text for k in ["rent must exceed", "rent freeze", "rent-stabilized", "rent-controlled"]),
        "inferred from rent-freeze/burden keywords"
    )

    min_rent_ratio = 0.333 if req_rent_burden and ("one-third of monthly income" in full_text or "rent must exceed" in full_text) else None

    # 5. Operational Status (Applications open vs closed)
    if "applications_open" in row and str(row.get("applications_open", "")).strip():
        apps_open = _parse_bool(row.get("applications_open"))
        if apps_open is None:
            apps_open = True
    else:
        apps_open = not ("applications are currently closed" in notes or "applications closed" in notes)
        if not apps_open:
            needs_review = True
            inferred_fields.append("applications_open (inferred as closed from notes)")

    return {
        "allowed_regions": [region, "national"] if region == "national" else [region],
        "min_household_size": min_hh,
        "max_household_size": max_hh,
        "max_annual_income": max_income,
        "min_age": min_age,
        "max_age": max_age,
        "requires_disability_benefit": req_disability,
        "requires_children": req_children,
        "requires_homeowner": req_homeowner,
        "requires_rent_burden": req_rent_burden,
        "min_rent_income_ratio": min_rent_ratio,
        "required_benefits_any": ["SSI", "SSDI", "VA_DISABILITY", "MEDICAID_DISABILITY"] if req_disability else [],
        "applications_open": apps_open,
        "needs_review": needs_review,
        "inferred_fields": inferred_fields
    }
