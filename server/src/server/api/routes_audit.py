import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from server.config import settings
from server.core.auth import Principal, require_cedar, get_current_principal
from server.agents.audit_agent import run_bias_audit, BiasAuditReport, _get_opensearch_client

log = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["Fairness & Bias Watchdog"])


class TriggerAuditRequest(BaseModel):
    batch_size: int = Field(default=8, ge=2, le=20)
    mode: str = Field(default="deterministic", description="'deterministic' or 'agentic'")
    audit_intake: bool = Field(default=False, description="Whether to re-extract profiles via IntakeAgent")


def _strip_pii_from_report_details(details: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns a copy of a stored audit report's `details` blob with anything
    that could carry PII or individual applicant-shaped profile data removed.
    This guarantees that the response honestly matches the containsPII: False
    assertion enforced by the Cedar readAuditMetrics policy.
    """
    safe = dict(details)
    raw_cases = safe.get("detailed_cases", [])
    safe["detailed_cases"] = [
        {
            "scenario_id": c.get("scenario_id") or c.get("test_id"),
            "test_id": c.get("test_id") or c.get("scenario_id"),
            "scenario_name": c.get("scenario_name"),
            "language": c.get("language"),
            "variation_type": c.get("variation_type"),
            "matched_program_ids": c.get("matched_program_ids", []),
            "match_count": c.get("match_count"),
            "execution_mode": c.get("execution_mode"),
            "error": c.get("error"),
            # Deliberately omitted: `profile` (structured applicant attributes)
            # and any raw input narrative. Neither belongs in a containsPII: False response.
        }
        for c in raw_cases
    ]
    return safe


@router.get(
    "/metrics",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("readAuditMetrics", {"type": "AuditLog", "containsPII": False}))],
    summary="Get aggregated fairness and disparate impact metrics",
)
async def get_audit_metrics():
    """
    Returns high-level algorithmic fairness telemetry.
    Filters exclusively for actual audit run reports and forwards aggregate fields.
    """
    client = _get_opensearch_client()
    try:
        res = client.search(
            index=settings.OPENSEARCH_INDEX_AUDIT,
            body={
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"action": "replaySyntheticProfiles"}},
                            {"exists": {"field": "details.run_id"}},
                        ]
                    }
                },
                "sort": [{"timestamp": {"order": "desc"}}],
                "size": 10,
            },
        )
        hits = res.get("hits", {}).get("hits", [])
        metrics_history = []
        for h in hits:
            src = h["_source"]
            details = src.get("details", {})
            if not details.get("run_id"):
                continue
            metrics_history.append({
                "run_id": details.get("run_id"),
                "timestamp": src.get("timestamp"),
                "fairness_status": details.get("fairness_status"),
                "disparate_impact_ratio": details.get("disparate_impact_ratio"),
                "languages_evaluated": details.get("languages_evaluated"),
                "selection_rates": details.get("selection_rates"),
                "disparity_summary": details.get("disparity_summary"),
            })
        return {
            "total_audit_runs": len(metrics_history),
            "latest_run": metrics_history[0] if metrics_history else None,
            "recent_runs": metrics_history,
        }
    except Exception as e:
        log.warning(f"[Audit] Error querying OpenSearch audit log: {e}")
        return {"total_audit_runs": 0, "latest_run": None, "recent_runs": []}


@router.post(
    "/run",
    response_model=BiasAuditReport,
    dependencies=[Depends(require_cedar("runAuditManually", {"type": "MatchingService"}))],
    summary="Trigger on-demand bias audit (Admin-only)",
)
async def trigger_manual_audit(
    req: TriggerAuditRequest,
    principal: Principal = Depends(get_current_principal),
):
    """
    Allows human administrators to manually initiate an algorithmic fairness
    replay. Attributed to the Admin's identity in OpenSearch audit logs.
    Includes full detailed_cases for the authorized Admin who triggered the run.
    """
    try:
        report = run_bias_audit(
            batch_size=req.batch_size,
            mode=req.mode,
            audit_intake=req.audit_intake,
        )
        return report
    except Exception as e:
        log.exception(f"[Audit] Error running manual bias audit: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to execute bias audit: {e}")


@router.get(
    "/reports/{run_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("readAuditMetrics", {"type": "AuditLog", "containsPII": False}))],
    summary="Get specific historical audit run details (PII-stripped)",
)
async def get_audit_report(run_id: str):
    """
    Returns detailed results of a specific audit run, with all applicant profiles
    and narratives stripped to maintain zero-PII compliance for Analyst callers.
    """
    client = _get_opensearch_client()
    try:
        res = client.search(
            index=settings.OPENSEARCH_INDEX_AUDIT,
            body={
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"action": "replaySyntheticProfiles"}},
                            {"term": {"details.run_id": run_id}},
                        ]
                    }
                }
            },
        )
        hits = res.get("hits", {}).get("hits", [])
        if not hits:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Audit run '{run_id}' not found")
        return _strip_pii_from_report_details(hits[0]["_source"]["details"])
    except HTTPException:
        raise
    except Exception as e:
        log.warning(f"[Audit] Search error for run_id {run_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error retrieving audit report")
