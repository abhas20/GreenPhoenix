import time
import secrets
import logging
from typing import Dict, List, Tuple, Optional
from fastapi import Request, HTTPException, status, Depends

from server.config import settings
from server.core.auth import Principal, get_current_principal

log = logging.getLogger(__name__)

# Singleton Redis client cache
_redis_client = None
_redis_init_attempted = False

# In-memory sliding window fallback tracking: {key: [timestamp1, timestamp2, ...]}
_memory_sliding_windows: Dict[str, List[float]] = {}


def get_redis_client():
    """Returns singleton Redis client or None if unavailable/unconfigured."""
    global _redis_client, _redis_init_attempted
    if not _redis_init_attempted:
        _redis_init_attempted = True
        redis_url = getattr(settings, "REDIS_URL", None)
        if redis_url:
            try:
                import redis
                client = redis.from_url(redis_url, decode_responses=True)
                client.ping()
                _redis_client = client
                log.info(f"[RateLimit] Connected to Redis rate limiter at {redis_url}")
            except Exception as e:
                log.warning(f"[RateLimit] Redis unavailable at {redis_url} ({e}); using in-memory sliding window fallback.")
                _redis_client = None
        else:
            log.warning("[RateLimit] REDIS_URL not configured; using in-memory rate limiter fallback.")
    return _redis_client


def get_client_ip(request: Request) -> str:
    """Extracts client IP address, checking X-Forwarded-For proxy header first."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


#!! Update later
# def get_client_ip(request: Request) -> str:
#     # Mangum surfaces the original Lambda event on the ASGI scope
#     aws_event = request.scope.get("aws.event")
#     if aws_event:
#         # HTTP API v2 shape
#         source_ip = aws_event.get("requestContext", {}).get("http", {}).get("sourceIp")
#         if source_ip:
#             return source_ip
#         # REST API (v1) shape
#         source_ip = aws_event.get("requestContext", {}).get("identity", {}).get("sourceIp")
#         if source_ip:
#             return source_ip
#     # Non-Lambda fallback (local dev, container deployment)
#     return request.client.host if request.client else "127.0.0.1"


def _check_redis_sliding_window(client, key: str, limit: int, window_seconds: int = 60) -> Tuple[bool, int]:
    """
    True sliding window rate check using Redis Sorted Sets (ZSET):
    - Members: f"{timestamp}:{random_hex}"
    - Scores: Unix timestamp in seconds (float)
    Returns: (is_allowed: bool, retry_after_seconds: int)
    """
    now = time.time()
    window_start = now - window_seconds
    zset_key = f"aid-navigator:ratelimit:zset:{key}"

    try:
        pipe = client.pipeline()
        # 1. Purge requests older than sliding window
        pipe.zremrangebyscore(zset_key, 0, window_start)
        # 2. Count requests remaining in the current window
        pipe.zcard(zset_key)
        # 3. Retrieve the oldest active timestamp in window for Retry-After calculation
        pipe.zrange(zset_key, 0, 0, withscores=True)
        results = pipe.execute()

        current_count = results[1]
        oldest_items = results[2]

        if current_count >= limit:
            if oldest_items:
                oldest_time = oldest_items[0][1]
                retry_after = max(1, int(window_seconds - (now - oldest_time)) + 1)
            else:
                retry_after = window_seconds
            return False, retry_after

        # Record this request into the sliding window
        unique_member = f"{now}:{secrets.token_hex(4)}"
        pipe = client.pipeline()
        pipe.zadd(zset_key, {unique_member: now})
        pipe.expire(zset_key, window_seconds + 5)
        pipe.execute()

        return True, 0

    except Exception as e:
        log.warning(f"[RateLimit] Redis sliding window operation failed ({e}); falling back to memory.")
        return _check_memory_sliding_window(key, limit, window_seconds)


def _check_memory_sliding_window(key: str, limit: int, window_seconds: int = 60) -> Tuple[bool, int]:
    """In-memory sliding window fallback using timestamp lists."""
    now = time.time()
    window_start = now - window_seconds

    timestamps = _memory_sliding_windows.get(key, [])
    # Filter out entries older than window
    valid_timestamps = [t for t in timestamps if t > window_start]

    if len(valid_timestamps) >= limit:
        oldest_time = valid_timestamps[0]
        retry_after = max(1, int(window_seconds - (now - oldest_time)) + 1)
        _memory_sliding_windows[key] = valid_timestamps
        return False, retry_after

    valid_timestamps.append(now)
    _memory_sliding_windows[key] = valid_timestamps
    return True, 0


def _evaluate_sliding_limit(key: str, limit: int, window_seconds: int = 60) -> Tuple[bool, int]:
    client = get_redis_client()
    if client:
        return _check_redis_sliding_window(client, key, limit, window_seconds)
    return _check_memory_sliding_window(key, limit, window_seconds)


async def check_chat_rate_limit(
    request: Request,
    principal: Principal = Depends(get_current_principal)
):
    """
    True sliding 60-second rate limiter to prevent cost abuse, scraping, and credential stuffing:
    - PublicApplicant: 15 turns / minute, dual-enforced on Client IP AND Session ID.
      (Stops attackers from bypassing limits by dropping or rotating cookies).
    - Caseworker / Admin: 60 turns / minute, enforced on authenticated Principal ID.
    """
    if principal.role in ["Caseworker", "Admin"]:
        limit = settings.RATE_LIMIT_CASEWORKER_PER_MINUTE
        user_key = f"user:{principal.role}:{principal.id}"
        allowed, retry_after = _evaluate_sliding_limit(user_key, limit, 60)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {principal.role}. Maximum {limit} requests per minute.",
                headers={"Retry-After": str(retry_after)}
            )
        return

    # PublicApplicant rate limiting
    session_limit = settings.RATE_LIMIT_TURNS_PER_MINUTE
    ip_limit = settings.RATE_LIMIT_IP_PER_MINUTE
    client_ip = get_client_ip(request)

    # 1. Check IP-based limit (anti-abuse / anti-cookie-dropping barrier)
    ip_key = f"ip:{client_ip}"
    allowed_ip, retry_after_ip = _evaluate_sliding_limit(ip_key, ip_limit, 60)
    if not allowed_ip:
        log.warning(f"[RateLimit] Rate limit exceeded for IP '{client_ip}' ({ip_limit}/min)")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for network. Maximum {ip_limit} requests per minute.",
            headers={"Retry-After": str(retry_after_ip)}
        )

    # 2. Check Session-based limit
    session_key = f"session:{principal.id}"
    allowed_sess, retry_after_sess = _evaluate_sliding_limit(session_key, session_limit, 60)
    if not allowed_sess:
        log.warning(f"[RateLimit] Rate limit exceeded for session '{principal.id}' ({session_limit}/min)")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for session. Maximum {session_limit} requests per minute.",
            headers={"Retry-After": str(retry_after_sess)}
        )


async def check_translate_rate_limit(request: Request):
    """
    Rate limiter for public UI translation endpoint.
    Enforces 30 batch requests/minute per client IP to protect AWS Translate and Gemini quotas.
    """
    client_ip = get_client_ip(request)
    ip_key = f"ratelimit:translate:ip:{client_ip}"
    limit = 30
    allowed, retry_after = _evaluate_sliding_limit(ip_key, limit, 60)
    if not allowed:
        log.warning(f"[RateLimit] Translation rate limit exceeded for IP '{client_ip}' ({limit}/min)")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Translation rate limit exceeded. Maximum {limit} requests per minute.",
            headers={"Retry-After": str(retry_after)}
        )

