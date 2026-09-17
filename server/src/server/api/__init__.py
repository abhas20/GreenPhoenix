from server.api.routes_chat import router as chat_router
from server.api.routes_programs import router as programs_router
from server.api.routes_caseworker import router as caseworker_router
from server.api.routes_audit import router as audit_router

__all__ = [
    "chat_router",
    "programs_router",
    "caseworker_router",
    "audit_router",

]
