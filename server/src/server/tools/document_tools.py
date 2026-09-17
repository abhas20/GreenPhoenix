from typing import Any, Dict, Optional
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
    name="get_program_requirements",
    description="Fetches required documents, application portal URL, and instructions for a specific aid program.",
)
def get_program_requirements(program_id: str) -> Dict[str, Any]:
    """
    Retrieves required verification documents (IDs, leases, tax forms) and application methods.

    Args:
        program_id: The program ID (e.g. 'nyc-snap-001', 'nyc-drie-001').

    Returns:
        Dictionary with:
          'found' (bool -- False means the lookup failed, NOT that no docs are needed),
          'name', 'organization', 'required_documents', 'application_url',
          'application_method', 'contact_phone', 'applications_open', and 'rules_need_review'.
    """
    client = _get_opensearch_client()
    try:
        doc = client.get(index=settings.OPENSEARCH_INDEX_PROGRAMS, id=program_id)
    except (OSConnectionError, RequestError, Exception) as e:
        return {
            "found": False,
            "program_id": program_id,
            "name": program_id,
            "organization": "",
            "error": f"Failed to retrieve requirements: {e}",
            "required_documents": [],
            "application_url": "",
            "application_method": "online",
            "contact_phone": "",
            "applications_open": None,
            "rules_need_review": True,
        }

    src = doc.get("_source", {})
    rules = src.get("eligibility_rules", {})

    return {
        "found": True,
        "program_id": program_id,
        "name": src.get("name", program_id),
        "organization": src.get("organization", ""),
        "required_documents": src.get("required_documents", []),
        "application_url": src.get("application_url", ""),
        "application_method": src.get("application_method", "online"),
        "contact_phone": src.get("contact_phone", ""),
        "applications_open": rules.get("applications_open", True),
        "rules_need_review": bool(rules.get("needs_review", False)),
    }
