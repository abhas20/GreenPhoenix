import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from server.config import settings
from server.tools.search_tools import _get_opensearch_client, ensure_hybrid_search_pipeline
from server.agents.orchestrator import _get_redis_client
from server.core.user_store import ensure_user_table
from server.api import (
    chat_router,
    programs_router,
    caseworker_router,
    audit_router,
    admin_router,
    auth_router,
    translate_router
)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger("server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verifies infrastructure connections on startup."""
    log.info(f"Starting {settings.APP_NAME} in [{settings.ENVIRONMENT}] mode...")

    # 1. OpenSearch Check & Hybrid Search Pipeline Initialization
    try:
        os_client = _get_opensearch_client()
        health = os_client.cluster.health()
        log.info(f"OpenSearch connected (cluster status: {health.get('status')})")
        ensure_hybrid_search_pipeline(os_client)
    except Exception as e:
        log.error(f"Failed to connect to OpenSearch at {settings.OPENSEARCH_HOST}: {e}")

    # 2. Redis Check
    try:
        r_client = _get_redis_client()
        if r_client:
            r_client.ping()
            log.info(f"Redis connected at {settings.REDIS_URL}")
        else:
            log.warning("Running without Redis (in-memory session store fallback active).")
    except Exception as e:
        log.warning(f"Redis connection failed ({e}), using in-memory store.")

    # 3. DynamoDB Check & User Store Table Initialization
    try:
        ensure_user_table()
    except Exception as e:
        log.warning(f"DynamoDB user table initialization check encountered error: {e}")

    yield

    log.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Multi-Agent Crisis Aid Navigator with Presidio PII Protection, Cedar Policy Authorization, and Hybrid Vector Search.",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Configuration for React Frontend (Vite on 5173)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # Crucial for HttpOnly aid_session cookie
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def session_cookie_middleware(request: Request, call_next):
    """
    Ensures HttpOnly session cookie is automatically attached to responses
    whenever a new session is minted or an incoming request lacked one.
    Respects explicit session resets/deletions.
    """
    response = await call_next(request)

    # If the request deliberately purged the session, do not attach
    if getattr(request.state, "session_deleted", False):
        return response

    session_id = getattr(request.state, "session_id", None)
    is_new = getattr(request.state, "is_new_session", False)

    if session_id and (is_new or settings.SESSION_COOKIE_NAME not in request.cookies):
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_id,
            max_age=86400,
            httponly=True,
            samesite="lax",
            secure=settings.COOKIE_SECURE,
            path="/"
        )

    return response

# Register API Domain Routers under /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(programs_router, prefix="/api/v1")
app.include_router(caseworker_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(translate_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health_check():
    """Liveness & readiness probe."""
    os_status = "unreachable"
    try:
        os_client = _get_opensearch_client()
        os_status = os_client.cluster.health().get("status", "unknown")
    except Exception:
        pass

    redis_status = "unreachable"
    try:
        r_client = _get_redis_client()
        if r_client and r_client.ping():
            redis_status = "connected"
    except Exception:
        pass

    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "opensearch": os_status,
        "redis": redis_status,
        "primary_llm_model": settings.PRIMARY_LLM_MODEL
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again or contact support."}
    )


def main():
    uvicorn.run("server.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
