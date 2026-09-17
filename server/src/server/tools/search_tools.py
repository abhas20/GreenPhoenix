from typing import Any, Dict, List, Optional
from strands import tool
from opensearchpy import OpenSearch, RequestError, ConnectionError as OSConnectionError

from server.config import settings
from server.core.embeddings import get_embedding
from server.core.cedar_gate import cedar_gate


_client: Optional[OpenSearch] = None
HYBRID_SEARCH_PIPELINE = "hybrid-norm-pipeline"


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
        ensure_hybrid_search_pipeline(_client)
    return _client


def ensure_hybrid_search_pipeline(client: OpenSearch) -> None:
    """
    Creates the score-normalization pipeline this tool depends on, if it
    doesn't already exist. BM25 scores are unbounded while k-NN cosine
    scores are bounded 0-1 -- combining them with a raw boost multiplier
    (as in the original version) doesn't correct for that scale mismatch.
    Call this once at startup / after index setup, not on every search.
    """
    try:
        client.transport.perform_request(
            "PUT",
            f"/_search/pipeline/{HYBRID_SEARCH_PIPELINE}",
            body={
                "description": "Normalize and combine BM25 + k-NN scores for hybrid search",
                "phase_results_processors": [
                    {
                        "normalization-processor": {
                            "normalization": {"technique": "min_max"},
                            "combination": {
                                "technique": "arithmetic_mean",
                                "parameters": {"weights": [0.4, 0.6]},
                            },
                        }
                    }
                ],
            },
        )
    except RequestError as e:
        # Pipeline likely already exists -- not fatal, just log it.
        print(f"[Info] hybrid search pipeline setup: {e}")


@tool(
    name="hybrid_search_programs",
    description="Performs hybrid semantic vector and keyword search across open aid programs in OpenSearch.",
)
def hybrid_search_programs(
    query: str,
    limit: int = 5,
    principal_id: str = "unknown",
    principal_role: str = "PublicApplicant",
    org_id: Optional[str] = None,
    include_closed: bool = False,
) -> List[Dict[str, Any]]:
    """
    Searches aid programs in OpenSearch using dense vector similarity and
    BM25 keyword matching, normalized and combined via an OpenSearch hybrid
    search pipeline. Protected by a Cedar authorization gate.

    Args:
        query: User crisis or aid description (e.g. 'help paying rent disability brooklyn').
        limit: Max number of candidate programs to return (default: 5).
        principal_id: Real identifier of the requesting session/user -- required for
            Cedar policies that check resource/principal relationships (e.g. org scoping).
        principal_role: Role of the principal making the request (default: PublicApplicant).
        org_id: Organization ID of the principal, if a Caseworker -- passed to Cedar.
        include_closed: If True, includes programs with applications_open=False.
            Default False so applicants aren't shown programs they can't actually apply to;
            caseworkers researching upcoming options may want this set True.

    Returns:
        List of candidate aid programs with match scores, details, and eligibility criteria.
        Returns an empty list (with a logged warning) if the search backend is unavailable,
        rather than raising -- callers should treat an empty list as "couldn't search right
        now," and the orchestrator should tell the user that plainly rather than silently
        reporting zero matches as if none exist.
    """
    principal = {"id": principal_id, "role": principal_role, "orgId": org_id}
    resource = {"type": "AidPrograms"}
    if not cedar_gate.is_authorized(principal=principal, action="searchPrograms", resource=resource):
        raise PermissionError(f"Cedar Policy Denied: Action 'searchPrograms' is forbidden for role '{principal_role}'")

    client = _get_opensearch_client()

    try:
        query_vector = get_embedding(query, dimension=settings.EMBEDDING_DIMENSION)
    except Exception as e:
        print(f"[Error] Embedding generation failed: {e}")
        return []

    filters = []
    if not include_closed:
        filters.append({"term": {"eligibility_rules.applications_open": True}})

    search_body: Dict[str, Any] = {
        "size": limit,
        "query": {
            "hybrid": {
                "queries": [
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["name^2", "description^2", "category^1.5", "other_eligibility_notes"],
                        }
                    },
                    {
                        "knn": {
                            "description_embedding": {
                                "vector": query_vector,
                                "k": limit,
                            }
                        }
                    },
                ]
            }
        },
    }
    if filters:
        # Hybrid query results still need the filter applied; OpenSearch hybrid
        # query supports a post_filter for this purpose.
        search_body["post_filter"] = {"bool": {"filter": filters}}

    try:
        response = client.search(
            index=settings.OPENSEARCH_INDEX_PROGRAMS,
            body=search_body,
            params={"search_pipeline": HYBRID_SEARCH_PIPELINE},
        )
    except (OSConnectionError, RequestError) as e:
        print(f"[Error] OpenSearch search failed: {e}")
        return []

    hits = response.get("hits", {}).get("hits", [])

    results = []
    for hit in hits:
        src = hit["_source"]
        rules = src.get("eligibility_rules", {})
        results.append({
            "program_id": src.get("program_id"),
            "name": src.get("name"),
            "organization": src.get("organization"),
            "category": src.get("category"),
            "description": src.get("description"),
            "region": src.get("region"),
            "income_threshold": src.get("income_threshold"),
            "eligibility_rules": rules,
            "rules_need_review": rules.get("needs_review", False),
            "required_documents": src.get("required_documents", []),
            "application_url": src.get("application_url"),
            "application_method": src.get("application_method"),
            "contact_phone": src.get("contact_phone"),
            "applications_open": rules.get("applications_open"),
            "score": hit.get("_score"),
        })

    return results