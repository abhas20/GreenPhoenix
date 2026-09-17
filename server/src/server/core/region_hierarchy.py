# Geography data, not eligibility logic -- extend this table as you add
# regions, rather than editing check_program_eligibility's code.

REGION_HIERARCHY: dict[str, list[str]] = {
    "brooklyn":       ["brooklyn", "nyc", "new york city", "new york", "statewide", "ny", "national"],
    "bronx":          ["bronx", "nyc", "new york city", "new york", "statewide", "ny", "national"],
    "manhattan":      ["manhattan", "nyc", "new york city", "new york", "statewide", "ny", "national"],
    "queens":         ["queens", "nyc", "new york city", "new york", "statewide", "ny", "national"],
    "staten island":  ["staten island", "nyc", "new york city", "new york", "statewide", "ny", "national"],
    "nyc":            ["nyc", "new york city", "new york", "statewide", "ny", "national"],
}


def region_matches(applicant_region: str, allowed_regions: list[str]) -> bool:
    """
    True if the applicant's region falls within any of the program's
    allowed_regions, walking the borough -> city -> state -> national
    hierarchy. Unknown applicant regions fall back to a direct
    case-insensitive match rather than silently failing closed.
    """
    reg_clean = applicant_region.strip().lower()
    allowed_lower = [r.strip().lower() for r in allowed_regions]

    candidates = REGION_HIERARCHY.get(reg_clean, [reg_clean])
    return any(c in allowed_lower for c in candidates) or "national" in allowed_lower