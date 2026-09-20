from typing import Optional, Any
from server.config import settings

try:
    from strands.models.gemini import GeminiModel
    from strands.models.bedrock import BedrockModel
    from strands.event_loop._retry import ModelRetryStrategy
    STRANDS_MODELS_AVAILABLE = True
except ImportError:
    STRANDS_MODELS_AVAILABLE = False
    ModelRetryStrategy = None


def get_fast_retry_strategy(max_attempts: int = 2):
    """
    Returns a fast retry strategy for agents to avoid long hangs on 429 throttling.
    Defaults to at most 2 attempts (1 initial attempt + 1 quick retry) before failing
    over to deterministic execution.
    """
    if ModelRetryStrategy is not None:
        return ModelRetryStrategy(max_attempts=max_attempts, initial_delay=1, max_delay=3)
    return None


def get_model(provider: Optional[str] = None) -> Optional[Any]:
    if not STRANDS_MODELS_AVAILABLE:
        return None

    chosen_provider = (provider or settings.MODEL_PROVIDER or "gemini").lower()

    if chosen_provider == "bedrock":
        from strands.models import BedrockModel
        return BedrockModel(
            model_id=settings.BEDROCK_MODEL_ID,
            region_name=settings.BEDROCK_REGION
        )

    if settings.GEMINI_API_KEY:
        from strands.models import GeminiModel
        return GeminiModel(
            model_id=settings.PRIMARY_LLM_MODEL,
            client_args={
                "api_key": settings.GEMINI_API_KEY,
                "http_options": {
                    "retry_options": {
                        "attempts": 2,
                        "initial_delay": 0.5,
                        "max_delay": 2.0,
                        "http_status_codes": [429, 500, 503, 504],
                    },
                    "timeout": 15000,
                },
            },
            params={"temperature": 0.2, "max_output_tokens": 4096},
        )

    return None
