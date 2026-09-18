from typing import Any, Dict, List, Optional
from strands import tool
from opensearchpy import OpenSearch, RequestError, ConnectionError as OSConnectionError

from server.config import settings

_client: Optional[OpenSearch] = None


def _get_opensearch_client() -> OpenSearch:
    """Reuses a single client instead of opening a new connection per call."""
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
    name="get_programs_requirements",
    description="Fetches required documents, application portal URL, and instructions for MULTIPLE aid programs at once.",
)
def get_programs_requirements(program_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Retrieves required verification documents for multiple programs in a single database call.

    Args:
        program_ids: A list of program IDs (e.g. ['nyc-snap-001', 'nyc-drie-001']).

    Returns:
        A dictionary mapping each program_id to its requirements dictionary.
    """
    client = _get_opensearch_client()
    results = {}

    if not program_ids:
        return results

    try:
        # Use mget (multi-get) to fetch all docs in one network request
        response = client.mget(
            index=settings.OPENSEARCH_INDEX_PROGRAMS,
            body={"ids": program_ids}
        )
    except (OSConnectionError, RequestError, Exception) as e:
        # If the entire request fails, mark all requested IDs as found=False
        for pid in program_ids:
            results[pid] = {
                "found": False,
                "program_id": pid,
                "name": pid,
                "error": f"Failed to retrieve requirements: {e}",
                "required_documents": [],
                "applications_open": None,
            }
        return results

    # Process the batch response
    for doc in response.get("docs", []):
        pid = doc.get("_id")
        
        if not doc.get("found", False):
            results[pid] = {
                "found": False,
                "program_id": pid,
                "name": pid,
                "error": "Program ID not found in database.",
                "required_documents": [],
                "applications_open": None,
            }
            continue

        src = doc.get("_source", {})
        rules = src.get("eligibility_rules", {})

        results[pid] = {
            "found": True,
            "program_id": pid,
            "name": src.get("name", pid),
            "organization": src.get("organization", ""),
            "required_documents": src.get("required_documents", []),
            "application_url": src.get("application_url", ""),
            "application_method": src.get("application_method", "online"),
            "contact_phone": src.get("contact_phone", ""),
            "applications_open": rules.get("applications_open", True),
            "rules_need_review": bool(rules.get("needs_review", False)),
        }

    return results