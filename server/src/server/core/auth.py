import datetime
import logging
import secrets
from typing import Dict, Any, Optional, Callable, Awaitable, Union
import jwt
from pydantic import BaseModel, Field
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from server.config import settings
from server.core.cedar_gate import cedar_gate

log = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


class Principal(BaseModel):
    id: str
    role: str = Field(default="PublicApplicant")
    org_id: Optional[str] = None
    name: Optional[str] = None
    is_authenticated: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "role": self.role,
            "orgId": self.org_id
        }


def create_access_token(
    sub: str,
    role: str,
    org_id: Optional[str] = None,
    name: Optional[str] = None,
    expires_delta: Optional[datetime.timedelta] = None
) -> str:
    """Generates signed JWT for sensitive roles (Caseworker, Analyst, Admin)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    exp = now + (expires_delta or datetime.timedelta(hours=12))
    payload = {
        "sub": sub,
        "role": role,
        "orgId": org_id,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp())
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


async def get_current_principal(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Principal:
    """
    Extracts caller identity:
    1. Privileged Bearer JWT (Caseworker, Analyst, Admin, AuditAgent).
       Validates presence and validity of required claims ('sub', 'role', 'orgId' for Caseworker).
    2. Unprivileged HttpOnly cookie 'aid_session' (PublicApplicant).
       Validates format or mints a cryptographically secure token_urlsafe(32) session id.
    """
    # 1. Privileged Bearer Token Path
    if auth_header and auth_header.credentials:
        token = auth_header.credentials
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            sub = payload.get("sub")
            role = payload.get("role")

            if not sub or not isinstance(sub, str) or not sub.strip():
                log.warning(f"[Auth] Token rejected: missing or blank 'sub' claim in {payload}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Malformed token: missing required 'sub' subject claim.",
                    headers={"WWW-Authenticate": "Bearer"}
                )

            valid_roles = {"PublicApplicant", "Caseworker", "Analyst", "Admin", "AuditAgent"}
            if not role or role not in valid_roles:
                log.warning(f"[Auth] Token rejected: missing or invalid 'role' claim '{role}'")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Malformed token: missing or invalid 'role' claim '{role}'. Must be one of {sorted(valid_roles)}.",
                    headers={"WWW-Authenticate": "Bearer"}
                )

            org_id = payload.get("orgId")
            if role == "Caseworker" and (not org_id or not isinstance(org_id, str) or not org_id.strip()):
                log.warning(f"[Auth] Token rejected: Caseworker role missing required 'orgId' claim: {payload}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Malformed token: Caseworker role requires a valid 'orgId' claim.",
                    headers={"WWW-Authenticate": "Bearer"}
                )

            principal = Principal(
                id=sub.strip(),
                role=role,
                org_id=org_id.strip() if org_id else None,
                name=payload.get("name"),
                is_authenticated=True
            )
            request.state.principal = principal
            return principal
        except HTTPException:
            raise
        except jwt.ExpiredSignatureError:
            log.warning(f"[Auth] Expired JWT presented from {request.client.host if request.client else 'unknown'}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except (jwt.InvalidSignatureError, jwt.DecodeError) as e:
            log.warning(f"[Auth] Invalid JWT signature/decode error from {request.client.host if request.client else 'unknown'}: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except Exception as e:
            log.error(f"[Auth] Unexpected error during token verification: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials.",
                headers={"WWW-Authenticate": "Bearer"}
            )

    # 2. Public Applicant Cookie Path
    raw_session = request.cookies.get(settings.SESSION_COOKIE_NAME)
    session_id = None
    is_new = False

    if raw_session:
        clean_session = raw_session.strip()
        # Ensure session ID meets length and character whitelist (urlsafe characters)
        if 16 <= len(clean_session) <= 128 and all(c.isalnum() or c in "-_" for c in clean_session):
            session_id = clean_session
        else:
            log.warning(f"[Auth] Suspicious or malformed session cookie received; generating fresh session.")

    if not session_id:
        session_id = secrets.token_urlsafe(32)
        is_new = True

    request.state.session_id = session_id
    request.state.is_new_session = is_new

    principal = Principal(
        id=session_id,
        role="PublicApplicant",
        org_id=None,
        name="Crisis Applicant",
        is_authenticated=False
    )
    request.state.principal = principal
    return principal


ResourceResolver = Callable[[Request], Awaitable[Dict[str, Any]]]


def require_cedar(action: str, resolver_or_static: Union[str, Dict[str, Any], ResourceResolver]):
    """
    Declarative FastAPI dependency enforcing Cedar authorization.
    Supports static resource types or async dynamic resolvers for org-scoping and session-scoping.
    Avoids tautological auto-binding: resolves explicit target session if present in request path/query.
    """
    async def dependency(request: Request, principal: Principal = Depends(get_current_principal)) -> Principal:
        if callable(resolver_or_static):
            resource = await resolver_or_static(request)
        elif isinstance(resolver_or_static, dict):
            resource = dict(resolver_or_static)
        elif isinstance(resolver_or_static, str):
            resource = {"type": resolver_or_static}
        else:
            resource = {"type": "Resource"}

        # CRITICAL FIX: Explicit Session Ownership Resolution
        if resource.get("type") == "Session":
            target_session_id = (
                request.path_params.get("session_id")
                or request.query_params.get("session_id")
            )
            if target_session_id:
                # Caller is explicitly targeting a specific session ID
                resource["sessionOwnerId"] = target_session_id
                resource["id"] = target_session_id
            elif "sessionOwnerId" not in resource:
                # Implicit self-session route (e.g. /chat/turn, /chat/session)
                resource["sessionOwnerId"] = principal.id
                resource["id"] = principal.id

        principal_dict = principal.to_dict()
        is_allowed = cedar_gate.is_authorized(
            principal=principal_dict,
            action=action,
            resource=resource,
            session_id=principal.id
        )

        if not is_allowed:
            log.warning(
                f"[Cedar Gate] Access DENIED for role='{principal.role}', principal='{principal.id}', "
                f"action='{action}', resource={resource}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cedar Policy Denied: Action '{action}' is not permitted for role '{principal.role}'."
            )

        return principal

    return dependency
