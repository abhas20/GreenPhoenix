#------------------------------------------------------------------------------
# Build command from repository root: docker build -t greenphoenix-backend -f server/Dockerfile .
# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# Stage 1: Builder (Dependency Resolution & Precompilation)
# ------------------------------------------------------------------------------
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Configure uv for containerized builds
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# Install build dependencies for compiled C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications first for Docker layer caching
COPY server/pyproject.toml server/uv.lock ./

# Install python dependencies into virtual environment without the project itself
RUN uv sync --frozen --no-install-project --no-dev

# Pre-download SpaCy linguistic models required by Microsoft Presidio PII Engine using uv pip
RUN uv pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.8.0/en_core_web_lg-3.8.0-py3-none-any.whl

# Copy project metadata and server source code, then install project into virtualenv
COPY server/README.md ./
COPY server/src/ ./src/
RUN uv sync --frozen --no-dev --inexact

# ------------------------------------------------------------------------------
# Stage 2: Final Production Runner (Minimal & Hardened)
# ------------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runner

WORKDIR /app

# Ensure python output is unbuffered and virtualenv binaries take precedence
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/src:$PYTHONPATH"

# Install curl for container healthcheck probe
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy prebuilt virtual environment with all precompiled wheels and SpaCy models
COPY --from=builder /app/.venv /app/.venv

# Copy application source code and metadata
COPY server/src/ ./src/
COPY server/README.md ./

# Copy Cedar authorization policies and statutory program datasets
COPY cedar/ ./cedar/
COPY data/ ./data/

# Create non-root unprivileged user and group for production security
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash appuser && \
    chown -R appuser:appgroup /app

USER appuser

# Expose default FastAPI HTTP port
EXPOSE 8000

# Container liveness & readiness healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production server entrypoint
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
