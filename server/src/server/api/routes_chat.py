import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from server.config import settings
from server.core.auth import Principal, require_cedar, get_current_principal
from server.core.rate_limit import check_chat_rate_limit
from server.agents.orchestrator import orchestrator, SessionState, NavigatorResponse
from server.agents.intake_agent import ApplicantProfile
from server.agents.matching_agent import MatchingResult
from server.agents.document_agent import ApplicationDraft

log = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Conversational Chat & Sessions"])


class ChatTurnRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User crisis or benefit query message")


class ChatTurnResponse(BaseModel):
    session_id: str
    reply_message: str
    clarification_needed: bool
    applicant_profile: ApplicantProfile
    matching_result: Optional[MatchingResult] = None
    application_draft: Optional[ApplicationDraft] = None


@router.post(
    "/turn",
    response_model=ChatTurnResponse,
    dependencies=[Depends(check_chat_rate_limit), Depends(require_cedar("readOwnSession", "Session"))],
    summary="Process multi-turn conversational chat turn"
)
async def process_chat_turn(
    req: ChatTurnRequest,
    principal: Principal = Depends(get_current_principal)
):
    """
    Main conversational intake & aid navigation endpoint:
    1. Presidio PII sanitization at the intake boundary.
    2. Strands Intake Agent profile fact extraction.
    3. OpenSearch hybrid search & deterministic eligibility verification.
    4. Strands Document Agent personalized application drafting.
    5. Session state persisted into Redis with 24-hour TTL.
    """
    turn_res: NavigatorResponse = orchestrator.process_user_turn(
        user_message=req.message,
        session_id=principal.id,
        principal_id=principal.id,
        principal_role=principal.role,
        org_id=principal.org_id
    )

    return ChatTurnResponse(
        session_id=turn_res.session_id,
        reply_message=turn_res.reply_message,
        clarification_needed=turn_res.clarification_needed,
        applicant_profile=turn_res.applicant_profile,
        matching_result=turn_res.matching_result,
        application_draft=turn_res.application_draft
    )


@router.get(
    "/session",
    response_model=SessionState,
    dependencies=[Depends(require_cedar("readOwnSession", "Session"))],
    summary="Retrieve current session profile, matches, and application draft"
)
def get_current_session(principal: Principal = Depends(get_current_principal)):
    session = orchestrator.store.get(principal.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return session


@router.get(
    "/session/{session_id}",
    response_model=SessionState,
    dependencies=[Depends(require_cedar("readOwnSession", "Session"))],
    summary="Retrieve specific session by ID (strictly isolated to owner)"
)
def get_session_by_id(
    session_id: str,
    principal: Principal = Depends(get_current_principal)
):
    if principal.role == "PublicApplicant" and session_id != principal.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access another applicant's session."
        )
    session = orchestrator.store.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return session


@router.delete(
    "/session",
    dependencies=[Depends(require_cedar("deleteOwnSession", "Session"))],
    summary="Purge session state and reset conversation history"
)
async def delete_current_session(
    request: Request,
    response: Response,
    principal: Principal = Depends(get_current_principal)
):
    orchestrator.store.reset(principal.id)
    request.state.session_deleted = True
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return {"status": "deleted", "message": "Session and conversation history purged successfully."}


@router.delete(
    "/session/{session_id}",
    dependencies=[Depends(require_cedar("deleteOwnSession", "Session"))],
    summary="Purge specific session by ID (strictly isolated to owner)"
)
async def delete_session_by_id(
    session_id: str,
    request: Request,
    response: Response,
    principal: Principal = Depends(get_current_principal)
):
    # Defense-in-depth: Verify session ownership at the route boundary
    if principal.role == "PublicApplicant" and session_id != principal.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot delete another applicant's session."
        )
    orchestrator.store.reset(session_id)
    request.state.session_deleted = True
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return {"status": "deleted", "message": f"Session '{session_id}' purged successfully."}
