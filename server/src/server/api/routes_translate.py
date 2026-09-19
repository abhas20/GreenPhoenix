import logging
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

from server.core.translation import translation_service, SUPPORTED_LANGUAGES
from server.agents.orchestrator import _get_redis_client
from server.core.rate_limit import check_translate_rate_limit

log = logging.getLogger(__name__)

router = APIRouter(prefix="/translate", tags=["UI Localization & Machine Translation"])

# In-memory fallback dictionary cache if Redis is temporarily offline
_MEMORY_I18N_CACHE: Dict[str, Dict[str, str]] = {}


def _get_redis():
    try:
        return _get_redis_client()
    except Exception:
        return None


class BatchTranslateRequest(BaseModel):
    texts: List[str] = Field(
        ...,
        min_length=1,
        max_length=500,
        description="List of English UI strings to translate"
    )
    target_language: str = Field(
        ...,
        min_length=2,
        max_length=10,
        description="Target ISO-639 language code (e.g. 'hi', 'bn', 'es', 'ta')"
    )


class BatchTranslateResponse(BaseModel):
    target_language: str
    translations: Dict[str, str]
    cached_count: int
    newly_translated_count: int


@router.post(
    "/batch",
    response_model=BatchTranslateResponse,
    dependencies=[Depends(check_translate_rate_limit)],
    summary="Translate batch of UI text strings with Redis caching"
)
def translate_batch_endpoint(req: BatchTranslateRequest):
    """
    Translates an arbitrary batch of English UI text strings into the target language.
    Checks Redis hash cache first. Any uncached strings are translated via
    Amazon Translate (with Gemini fallback) and immediately saved to Redis.
    """
    target_lang = (req.target_language or "en").strip().lower()

    # If target is English, identity return with zero translation overhead
    if target_lang == "en":
        identity_map = {t: t for t in req.texts}
        return BatchTranslateResponse(
            target_language="en",
            translations=identity_map,
            cached_count=len(req.texts),
            newly_translated_count=0
        )

    redis_client = _get_redis()
    redis_key = f"greenphoenix:i18n:{target_lang}"

    translations: Dict[str, str] = {}
    missing_texts: List[str] = []
    cached_count = 0

    # 1. Check Cache (Redis or In-Memory)
    if redis_client:
        try:
            cached_vals = redis_client.hmget(redis_key, req.texts)
            for text, val in zip(req.texts, cached_vals):
                if val is not None:
                    translations[text] = val
                    cached_count += 1
                else:
                    missing_texts.append(text)
        except Exception as e:
            log.warning(f"[i18n] Redis hmget error ({e}); using memory fallback.")
            missing_texts = req.texts
    else:
        mem_cache = _MEMORY_I18N_CACHE.setdefault(target_lang, {})
        for text in req.texts:
            if text in mem_cache:
                translations[text] = mem_cache[text]
                cached_count += 1
            else:
                missing_texts.append(text)

    # 2. Translate Missing Texts via Dual-Engine Service
    newly_translated_count = 0
    if missing_texts:
        # Deduplicate
        unique_missing = list(set(missing_texts))
        translated_results = translation_service.translate_batch(unique_missing, target_lang)

        # Merge results into overall map
        for t in missing_texts:
            translated_val = translated_results.get(t, t)
            translations[t] = translated_val

        newly_translated_count = len(translated_results)

        # 3. Write newly translated strings to Cache
        if redis_client and translated_results:
            try:
                redis_client.hset(redis_key, mapping=translated_results)
                # Persist translations with a 30-day TTL
                redis_client.expire(redis_key, 60 * 60 * 24 * 30)
            except Exception as e:
                log.warning(f"[i18n] Redis hset cache write error ({e}).")

        # Also populate memory cache fallback
        mem_cache = _MEMORY_I18N_CACHE.setdefault(target_lang, {})
        mem_cache.update(translated_results)

    return BatchTranslateResponse(
        target_language=target_lang,
        translations=translations,
        cached_count=cached_count,
        newly_translated_count=newly_translated_count
    )


@router.get(
    "/cache/{target_language}",
    response_model=Dict[str, str],
    summary="Get all cached UI translations for a language"
)
def get_language_cache(target_language: str):
    """
    Retrieves the entire cached translation dictionary for a target language.
    Enables instant client-side dictionary hydration upon language selection.
    """
    target_lang = target_language.strip().lower()
    if target_lang == "en":
        return {}

    redis_client = _get_redis()
    if redis_client:
        try:
            cached = redis_client.hgetall(f"greenphoenix:i18n:{target_lang}")
            if cached:
                return cached
        except Exception as e:
            log.warning(f"[i18n] Redis hgetall error: {e}")

    return _MEMORY_I18N_CACHE.get(target_lang, {})


@router.get(
    "/languages",
    response_model=Dict[str, str],
    summary="List all supported languages with codes and native labels"
)
def list_languages():
    """Returns the map of ISO language codes to English names."""
    return SUPPORTED_LANGUAGES


@router.delete(
    "/cache/{target_language}",
    summary="Purge translation cache for a language (Admin/Dev)"
)
def purge_language_cache(target_language: str):
    """Clears cached translations for a specific language."""
    target_lang = target_language.strip().lower()
    redis_client = _get_redis()
    if redis_client:
        try:
            redis_client.delete(f"greenphoenix:i18n:{target_lang}")
        except Exception as e:
            log.warning(f"[i18n] Redis delete error: {e}")

    _MEMORY_I18N_CACHE.pop(target_lang, None)
    return {"status": "purged", "language": target_lang}
