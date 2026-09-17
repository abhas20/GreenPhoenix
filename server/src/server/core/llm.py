from typing import Optional, Any
from server.config import settings

try:
    from strands.models.gemini import GeminiModel
    from strands.models.bedrock import BedrockModel
    STRANDS_MODELS_AVAILABLE = True
except ImportError:
    STRANDS_MODELS_AVAILABLE = False


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
            client_args={"api_key": settings.GEMINI_API_KEY},
            params={"temperature": 0.2, "max_output_tokens": 4096},
        )

    return None
