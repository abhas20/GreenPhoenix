import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from server.core.auth import Principal, create_access_token, get_current_principal
from server.core.user_store import user_store, verify_password

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="User password (minimum 8 characters)")
    name: str = Field(..., min_length=2, description="Full name or display title")
    role: str = Field(..., description="Role claim: 'Caseworker', 'Analyst', or 'Admin'")
    org_id: Optional[str] = Field(default=None, description="Mandatory for Caseworker (e.g. 'hra_nyc')")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    org_id: Optional[str] = None
    created_at: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new sensitive identity (Caseworker, Analyst, Admin)"
)
def register_user(req: RegisterRequest):
    """
    Open self-registration for sensitive role personas:
    - Validates role membership against Cedar policy vocabulary.
    - Strictly enforces 'org_id' specification for Caseworkers.
    - Stores credentials safely hashed via bcrypt in DynamoDB.
    """
    valid_roles = {"Caseworker", "Analyst", "Admin"}
    if req.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{req.role}'. Must be one of {sorted(valid_roles)}."
        )

    if req.role == "Caseworker" and (not req.org_id or not req.org_id.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Caseworker registration requires an 'org_id' (e.g. 'hra_nyc' or 'queens_cbo')."
        )

    try:
        user = user_store.create_user(
            email=req.email,
            password=req.password,
            name=req.name,
            role=req.role,
            org_id=req.org_id
        )
        log.info(f"[Auth] Registered new user '{user['email']}' with role='{user['role']}'")
        return UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            org_id=user.get("org_id"),
            created_at=user["created_at"]
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(ve)
        )
    except Exception as e:
        log.error(f"[Auth] Registration error for '{req.email}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user."
        )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate with email & password to obtain Bearer JWT token"
)
def login_user(req: LoginRequest):
    """
    Authenticates sensitive role users:
    - Validates credentials against DynamoDB bcrypt hash.
    - Issues a signed Bearer JWT with 'sub', 'role', 'orgId', and 'name'.
    """
    user = user_store.get_by_email(req.email)
    if not user or not verify_password(req.password, user.get("hashed_password", "")):
        log.warning(f"[Auth] Failed login attempt for '{req.email}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact support."
        )

    token = create_access_token(
        sub=user["id"],
        role=user["role"],
        org_id=user.get("org_id"),
        name=user.get("name")
    )

    log.info(f"[Auth] Successful login for '{user['email']}' (role='{user['role']}')")

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            org_id=user.get("org_id"),
            created_at=user["created_at"]
        )
    )


@router.get(
    "/me",
    response_model=Dict[str, Any],
    summary="Retrieve profile of currently authenticated sensitive user"
)
def get_current_user_profile(principal: Principal = Depends(get_current_principal)):
    """Returns profile for current Bearer token holder."""
    if not principal.is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for profile lookup.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return {
        "id": principal.id,
        "role": principal.role,
        "org_id": principal.org_id,
        "name": principal.name,
        "is_authenticated": True
    }
