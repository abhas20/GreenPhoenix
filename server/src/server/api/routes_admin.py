import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from server.core.auth import Principal, require_cedar, get_current_principal
from server.data.seed import main as seed_main

log = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["System Administration"])


@router.post(
    "/indices/reseed",
    response_model=Dict[str, Any],
    dependencies=[Depends(require_cedar("manageIndices", {"type": "SearchIndex"}))],
    summary="Reseed OpenSearch index and rebuild hybrid search pipeline (Admin-only)"
)
async def reseed_search_indices(principal: Principal = Depends(get_current_principal)):
    try:
        log.info(f"[Admin] Reseeding OpenSearch index triggered by admin '{principal.id}'")
        seed_main()
        return {
            "status": "success",
            "message": "OpenSearch index and hybrid search pipeline successfully re-seeded from CSV dataset."
        }
    except Exception as e:
        log.exception(f"[Admin] Reseed error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reseed index: {e}")
