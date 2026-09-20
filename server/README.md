# GreenPhoenix Server — Backend API & Multi-Agent Engine

This directory contains the Python FastAPI backend and Strands multi-agent orchestration service for **GreenPhoenix (Community Aid Navigator)**.

---

## 🏛️ Architecture Overview

The backend is organized into specialized layers:
- **`server.agents`**: Strands multi-agent orchestration (`orchestrator.py`, `intake_agent.py`, `matching_agent.py`, `document_agent.py`, `audit_agent.py`).
- **`server.core`**:
  - `llm.py`: Google Gemini 2.5 Flash / Pro model wrapper with fast 429 retry strategy (`get_fast_retry_strategy`).
  - `auth.py`: AWS Cedar policy enforcement engine + JWT Bearer token authentication.
  - `presidio_sanitizer.py`: Microsoft Presidio PII anonymizer and surrogate token vault.
  - `rate_limit.py`: Redis sliding-window rate limiter (15 turns/min session, 80 req/min IP).
  - `region_hierarchy.py`: Global, national, and municipal administrative resolver (supporting India, US, UK, Canada).
  - `rules_parser.py`: Multi-currency statutory eligibility parser (INR, Lakhs, USD, GBP, EUR).
  - `user_store.py`: DynamoDB user repository with atomic registration and in-memory fallback.
  - `translation.py`: AWS Translate batch integration with local caching.
- **`server.tools`**: OpenSearch hybrid search (k-NN dense vectors + BM25 text) and deterministic eligibility tools.
- **`server.routers`**: FastAPI route handlers for chat, programs, caseworker cases, audit, and authentication.

---

## 🚀 Quickstart

### 1. Requirements
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Running OpenSearch and Redis containers (`docker compose up -d` in project root)

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY and credentials
```

### 3. Seed OpenSearch Index
Populate the `aid-programs` index with dense vector embeddings:
```bash
uv run python -m server.data.seed
```

### 4. Run Development Server
```bash
uv run uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger docs: `http://localhost:8000/docs`

---

## 🧪 Testing

Run automated integration tests using `uv`:

```bash
# 1. Test multi-turn clarification loop and fast 429 failover
uv run python src/server/tests/test_clarification_loop.py

# 2. Test AWS Cedar authorization policies
uv run python src/server/tests/test_cedar_auth.py

# 3. Test Redis sliding-window rate limiting
uv run python src/server/tests/test_rate_limit.py

# 4. Test OpenSearch hybrid search & vector embeddings
uv run python src/server/tests/test_opensearch.py
```
