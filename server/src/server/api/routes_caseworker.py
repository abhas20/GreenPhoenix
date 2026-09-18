import datetime
import json
import logging
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from server.config import settings
from server.core.auth import Principal, require_cedar, get_current_principal
from server.core.presidio_sanitizer import sanitizer
from server.agents.intake_agent import ApplicantProfile
from server.agents.orchestrator import _get_redis_client

log = logging.getLogger(__name__)

router = APIRouter(prefix="/caseworker", tags=["Caseworker Case Management"])

# In-memory case storage fallback
_MEMORY_CASES: Dict[str, Dict[str, Any]] = {}

# Fields that must NEVER appear in standard case responses unless the route is
# specifically authorized for readPiiVault or exportApplication.
_PII_FIELDS = ("client_name_real", "client_phone", "pii_vault")


def _redact_case(case: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns a sanitized view of the case document with real-identity fields stripped.
    `client_name_masked` (e.g. "<PERSON_1>") and `sanitized_summary` remain visible.
    """
    return {k: v for k, v in case.items() if k not in _PII_FIELDS}


def _case_key(case_id: str) -> str:
    return f"aid-navigator:case:{case_id}"


def _get_case(case_id: str) -> Optional[Dict[str, Any]]:
    client = _get_redis_client()
    if client:
        try:
            raw = client.get(_case_key(case_id))
            if raw:
                return json.loads(raw)
        except Exception as e:
            log.warning(f"[Caseworker] Redis get case error: {e}")
    return _MEMORY_CASES.get(case_id)


def _save_case(case: Dict[str, Any]) -> None:
    case_id = case["case_id"]
    client = _get_redis_client()
    if client:
        try:
            client.set(_case_key(case_id), json.dumps(case), ex=60 * 60 * 24 * 30)
            return
        except Exception as e:
            log.warning(f"[Caseworker] Redis save case error: {e}")
    _MEMORY_CASES[case_id] = case


async def resolve_case_resource(request: Request) -> Dict[str, Any]:
    """Dynamic resource resolver fetching target case orgId for Cedar authorization."""
    case_id = request.path_params.get("case_id")
    if case_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing case_id in path")
    case = _get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case '{case_id}' not found")
    return {
        "type": "ApplicantRecord",
        "id": case_id,
        "orgId": case.get("org_id"),
    }


async def resolve_caseworker_org_resource(request: Request) -> Dict[str, Any]:
    """Resolves caseworker's organizational scope for batch queries and case creation."""
    principal = getattr(request.state, "principal", None)
    return {
        "type": "ApplicantRecord",
        "orgId": principal.org_id if principal else None,
    }


class CreateCaseRequest(BaseModel):
    client_name: str
    client_phone: Optional[str] = None
    summary: str
    borough: str
    annual_income: float
    monthly_rent: Optional[float] = None
    has_disability_benefits: Optional[bool] = None
    primary_needs: List[str] = Field(default_factory=list)


class RevealPiiResponse(BaseModel):
    case_id: str
    client_name: str
    client_phone: Optional[str]
    unmasked_summary: str
    audit_logged: bool


@router.get(
    "/cases",
    response_model=List[Dict[str, Any]],
    dependencies=[Depends(require_cedar("readApplicantRecord", resolve_caseworker_org_resource))],
    summary="List active cases within caseworker organization (PII-redacted)",
)
def list_cases(principal: Principal = Depends(get_current_principal)):
    client = _get_redis_client()
    cases = []
    if client:
        try:
            keys = client.keys("aid-navigator:case:*")
            for k in keys:
                raw = client.get(k)
                if raw:
                    c = json.loads(raw)
                    if c.get("org_id") == principal.org_id:
                        cases.append(_redact_case(c))
            return cases
        except Exception as e:
            log.warning(f"[Caseworker] Redis list cases error: {e}")

    for c in _MEMORY_CASES.values():
        if c.get("org_id") == principal.org_id:
            cases.append(_redact_case(c))
    return cases


@router.post(
    "/cases",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("draftApplication", resolve_caseworker_org_resource))],
    summary="Create a new client case under caseworker organization (PII-redacted response)",
)
def create_case(
    req: CreateCaseRequest,
    principal: Principal = Depends(get_current_principal),
):
    case_id = f"case_{uuid.uuid4().hex[:8]}"
    raw_text = f"Applicant {req.client_name}, phone {req.client_phone or 'N/A'}. {req.summary}"
    sanitized_text, vault = sanitizer.sanitize(raw_text)

    masked_name = next(
        (k for k, v in vault.items() if req.client_name.lower() in v.lower()),
        "<PERSON_1>"
    )

    profile = ApplicantProfile(
        borough=req.borough,
        annual_income=req.annual_income,
        monthly_rent=req.monthly_rent,
        has_disability_benefits=req.has_disability_benefits,
        primary_needs=req.primary_needs,
        summary=req.summary,
    )

    case_doc = {
        "case_id": case_id,
        "org_id": principal.org_id,
        "created_by": principal.id,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "client_name_masked": masked_name,
        "client_name_real": req.client_name,
        "client_phone": req.client_phone,
        "sanitized_summary": sanitized_text,
        "profile": profile.model_dump(mode="json"),
        "pii_vault": vault,
    }

    _save_case(case_doc)
    # The creator response is redacted to ensure only reveal-pii serves raw PII
    return _redact_case(case_doc)


@router.get(
    "/cases/{case_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("readApplicantRecord", resolve_case_resource))],
    summary="Get case details, PII-redacted (scoped to caseworker organization)",
)
def get_case_details(case_id: str):
    case = _get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case '{case_id}' not found")
    return _redact_case(case)


@router.post(
    "/cases/{case_id}/reveal-pii",
    response_model=RevealPiiResponse,
    dependencies=[Depends(require_cedar("readPiiVault", resolve_case_resource))],
    summary="Explicit on-demand PII unmasking for portal submission",
)
def reveal_case_pii(
    case_id: str,
    principal: Principal = Depends(get_current_principal),
):
    """
    Strict on-demand unmasking for caseworkers filing on behalf of client.
    Authorized under Cedar Policy 3 with mandatory structured audit logging.
    """
    case = _get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case '{case_id}' not found")

    vault = case.get("pii_vault", {})
    sanitized = case.get("sanitized_summary", "")
    unmasked = sanitizer.rehydrate(sanitized, vault)

    # Server-side structured compliance audit log
    log.info(
        f"[PII_REVEAL] case_id={case_id} principal={principal.id} "
        f"role={principal.role} org_id={principal.org_id} "
        f"timestamp={datetime.datetime.now(datetime.timezone.utc).isoformat()}"
    )

    return RevealPiiResponse(
        case_id=case_id,
        client_name=case.get("client_name_real", "Unknown"),
        client_phone=case.get("client_phone"),
        unmasked_summary=unmasked,
        audit_logged=True,
    )


@router.get(
    "/cases/{case_id}/export",
    response_model=Dict[str, Any],
    dependencies=[
        Depends(require_cedar("exportApplication", resolve_case_resource)),
        Depends(require_cedar("readPiiVault", resolve_case_resource)),
    ],
    summary="Export consolidated case packet (includes unmasked PII for agency submission)",
)
def export_case(
    case_id: str,
    principal: Principal = Depends(get_current_principal),
):
    case = _get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case '{case_id}' not found")

    log.info(
        f"[PII_REVEAL] via export case_id={case_id} principal={principal.id} "
        f"role={principal.role} org_id={principal.org_id} "
        f"timestamp={datetime.datetime.now(datetime.timezone.utc).isoformat()}"
    )

    return {
        "case_id": case_id,
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "case_data": case,  # Full unredacted packet for submission
    }
