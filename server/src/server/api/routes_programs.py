import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from server.config import settings
from server.core.auth import Principal, require_cedar, get_current_principal
from server.tools.search_tools import hybrid_search_programs, _get_opensearch_client
from server.tools.eligibility_tools import check_program_eligibility
from server.tools.document_tools import get_program_requirements

log = logging.getLogger(__name__)

router = APIRouter(prefix="/programs", tags=["Aid Programs & Verification"])


class EligibilityCheckRequest(BaseModel):
    annual_income: Optional[float] = None
    household_size: Optional[int] = None
    age: Optional[int] = None
    region: Optional[str] = None
    has_disability_benefits: Optional[bool] = None
    disability_benefit_types: Optional[List[str]] = None
    has_children: Optional[bool] = None
    is_homeowner: Optional[bool] = None
    monthly_rent: Optional[float] = None


@router.get(
    "/search",
    response_model=List[Dict[str, Any]],
    dependencies=[Depends(require_cedar("searchPrograms", "AidPrograms"))],
    summary="Search aid programs via OpenSearch hybrid vector + BM25"
)
async def search_aid_programs(
    query: str = Query(..., min_length=2, description="Search terms, location, or crisis description"),
    limit: int = Query(6, ge=1, le=20),
    include_closed: bool = Query(False),
    principal: Principal = Depends(get_current_principal)
):
    return hybrid_search_programs(
        query=query,
        limit=limit,
        principal_id=principal.id,
        principal_role=principal.role,
        org_id=principal.org_id,
        include_closed=include_closed
    )


@router.get(
    "/{program_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("getProgramRequirements", "AidPrograms"))],
    summary="Get detailed program metadata and rules"
)
async def get_program_details(program_id: str):
    client = _get_opensearch_client()
    try:
        doc = client.get(index=settings.OPENSEARCH_INDEX_PROGRAMS, id=program_id)
        return doc["_source"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Program '{program_id}' not found")


@router.post(
    "/{program_id}/check-eligibility",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("checkEligibility", "AidPrograms"))],
    summary="Deterministic eligibility qualification check"
)
async def evaluate_eligibility(
    program_id: str,
    req: EligibilityCheckRequest,
    principal: Principal = Depends(get_current_principal)
):
    return check_program_eligibility(
        program_id=program_id,
        principal_id=principal.id,
        principal_role=principal.role,
        org_id=principal.org_id,
        annual_income=req.annual_income,
        household_size=req.household_size,
        age=req.age,
        region=req.region,
        has_disability_benefits=req.has_disability_benefits,
        disability_benefit_types=req.disability_benefit_types,
        has_children=req.has_children,
        is_homeowner=req.is_homeowner,
        monthly_rent=req.monthly_rent
    )


@router.get(
    "/{program_id}/requirements",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("getProgramRequirements", "AidPrograms"))],
    summary="Get required documents and application checklist"
)
async def get_requirements(program_id: str):
    return get_program_requirements(program_id=program_id)
