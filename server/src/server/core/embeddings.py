import hashlib
import math
from typing import List, Optional
from server.config import settings

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


def _generate_fallback_embedding(text: str, dimension: int = 768) -> List[float]:
    """
    Deterministic pseudo-semantic embedding for offline development / testing
    when no Gemini API key is configured.
    """
    tokens = text.lower().split()
    vector = [0.0] * dimension
    for i, token in enumerate(tokens):
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dimension
        sign = 1.0 if (h % 2 == 0) else -1.0
        weight = 1.0 / math.sqrt(i + 1.0)
        vector[idx] += sign * weight
    
    # Normalize vector to unit length (L2 norm)
    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0:
        vector = [x / norm for x in vector]
    else:
        vector[0] = 1.0
    return vector


def get_embedding(text: str, dimension: int = 768) -> List[float]:
    """
    Generates dense vector embeddings using Google GenAI SDK (gemini-embedding-001).
    Falls back gracefully to local deterministic embedding if API key is not configured.
    """
    if settings.GEMINI_API_KEY and GENAI_AVAILABLE:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            result = client.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=text,
                config=types.EmbedContentConfig(output_dimensionality=dimension)
            )
            if not result.embeddings or not result.embeddings[0].values:
                raise ValueError("Gemini API returned no embedding values.")
            return result.embeddings[0].values
        except Exception as e:
            print(f"[Warning] Gemini Embedding API error ({e}). Using local fallback embedding.")
            return _generate_fallback_embedding(text, dimension=dimension)
    
    return _generate_fallback_embedding(text, dimension=dimension)


def get_embeddings_batch(texts: List[str], dimension: int = 768) -> List[List[float]]:
    """
    Generates embeddings for a batch of strings.
    """
    return [get_embedding(t, dimension=dimension) for t in texts]
