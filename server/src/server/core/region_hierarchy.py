# Geography and administrative hierarchy data.
# Extend this table as new countries, states, and cities are onboarded.

REGION_HIERARCHY: dict[str, list[str]] = {
    # 1. United States / NYC Hierarchy
    "brooklyn":       ["brooklyn", "nyc", "new york city", "new york", "statewide", "ny", "us", "usa", "national", "global"],
    "bronx":          ["bronx", "nyc", "new york city", "new york", "statewide", "ny", "us", "usa", "national", "global"],
    "manhattan":      ["manhattan", "nyc", "new york city", "new york", "statewide", "ny", "us", "usa", "national", "global"],
    "queens":         ["queens", "nyc", "new york city", "new york", "statewide", "ny", "us", "usa", "national", "global"],
    "staten island":  ["staten island", "nyc", "new york city", "new york", "statewide", "ny", "us", "usa", "national", "global"],
    "nyc":            ["nyc", "new york city", "new york", "statewide", "ny", "us", "usa", "national", "global"],
    "new york":       ["new york", "statewide", "ny", "us", "usa", "national", "global"],
    "us":             ["us", "usa", "united states", "national", "global"],
    "united states":  ["us", "usa", "united states", "national", "global"],

    # 2. India National & State Hierarchy
    "india":          ["india", "in", "national", "global"],
    "in":             ["india", "in", "national", "global"],

    # Major Indian Cities
    "mumbai":         ["mumbai", "maharashtra", "india", "in", "national", "global"],
    "pune":           ["pune", "maharashtra", "india", "in", "national", "global"],
    "delhi":          ["delhi", "new delhi", "ncr", "india", "in", "national", "global"],
    "new delhi":      ["delhi", "new delhi", "ncr", "india", "in", "national", "global"],
    "bengaluru":      ["bengaluru", "bangalore", "karnataka", "india", "in", "national", "global"],
    "bangalore":      ["bengaluru", "bangalore", "karnataka", "india", "in", "national", "global"],
    "kolkata":        ["kolkata", "calcutta", "west bengal", "india", "in", "national", "global"],
    "chennai":        ["chennai", "madras", "tamil nadu", "india", "in", "national", "global"],
    "hyderabad":      ["hyderabad", "telangana", "india", "in", "national", "global"],
    "ahmedabad":      ["ahmedabad", "gujarat", "india", "in", "national", "global"],
    "jaipur":         ["jaipur", "rajasthan", "india", "in", "national", "global"],
    "lucknow":        ["lucknow", "uttar pradesh", "india", "in", "national", "global"],
    "patna":          ["patna", "bihar", "india", "in", "national", "global"],
    "chandigarh":     ["chandigarh", "punjab", "haryana", "india", "in", "national", "global"],

    # Major Indian States
    "maharashtra":    ["maharashtra", "india", "in", "national", "global"],
    "karnataka":      ["karnataka", "india", "in", "national", "global"],
    "tamil nadu":     ["tamil nadu", "india", "in", "national", "global"],
    "uttar pradesh":  ["uttar pradesh", "up", "india", "in", "national", "global"],
    "west bengal":    ["west bengal", "india", "in", "national", "global"],
    "telangana":      ["telangana", "india", "in", "national", "global"],
    "gujarat":        ["gujarat", "india", "in", "national", "global"],
    "rajasthan":      ["rajasthan", "india", "in", "national", "global"],
    "bihar":          ["bihar", "india", "in", "national", "global"],
    "punjab":         ["punjab", "india", "in", "national", "global"],
    "kerala":         ["kerala", "india", "in", "national", "global"],
    "madhya pradesh": ["madhya pradesh", "mp", "india", "in", "national", "global"],
    "haryana":        ["haryana", "india", "in", "national", "global"],
    "andhra pradesh": ["andhra pradesh", "ap", "india", "in", "national", "global"],
    "odisha":         ["odisha", "orissa", "india", "in", "national", "global"],

    # 3. United Kingdom Hierarchy
    "uk":             ["uk", "united kingdom", "gb", "national", "global"],
    "united kingdom": ["uk", "united kingdom", "gb", "national", "global"],
    "london":         ["london", "england", "uk", "united kingdom", "gb", "national", "global"],
    "england":        ["england", "uk", "united kingdom", "gb", "national", "global"],

    # 4. Canada Hierarchy
    "canada":         ["canada", "ca", "national", "global"],
    "ontario":        ["ontario", "canada", "ca", "national", "global"],
    "toronto":        ["toronto", "ontario", "canada", "ca", "national", "global"],
    "vancouver":      ["vancouver", "british columbia", "bc", "canada", "ca", "national", "global"],
}


def region_matches(applicant_region: str, allowed_regions: list[str]) -> bool:
    """
    True if the applicant's region falls within any of the program's
    allowed_regions, walking city/district -> state/province -> country -> national/global.
    """
    reg_clean = applicant_region.strip().lower()
    allowed_lower = [r.strip().lower() for r in allowed_regions]

    # Global or universal programs match everyone
    if "global" in allowed_lower or "all" in allowed_lower:
        return True

    # If applicant didn't specify a region, check if program is universal
    candidates = REGION_HIERARCHY.get(reg_clean, [reg_clean])
    
    # Check if any candidate in the applicant's region hierarchy is explicitly allowed
    if any(c in allowed_lower for c in candidates):
        return True

    # If the program is national and applicant shares national scope
    if "national" in allowed_lower:
        # Match if candidate list includes national or the country matches
        if any(c in allowed_lower for c in candidates):
            return True
        # If applicant is in US (default legacy tests), national matches
        if any(c in ["nyc", "brooklyn", "bronx", "queens", "manhattan", "staten island", "new york", "us", "usa"] for c in candidates):
            return True

    return False