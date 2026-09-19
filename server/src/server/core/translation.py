import logging
from typing import Optional, Tuple, Dict, List
import boto3
from botocore.exceptions import ClientError, BotoCoreError

from server.config import settings

log = logging.getLogger(__name__)

SUPPORTED_LANGUAGES: Dict[str, str] = {
    "en": "English",
    # Indian Languages
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
    # Global Languages
    "es": "Spanish",
    "zh": "Mandarin Chinese",
    "ar": "Arabic",
    "ru": "Russian",
    "fr": "French",
    "ht": "Haitian Creole",
    "pt": "Portuguese",
}


import os


def _get_aws_translate_client():
    """Returns boto3 Amazon Translate client using configured credentials."""
    try:
        kwargs = {"region_name": settings.AWS_REGION}
        ak = (settings.AWS_ACCESS_KEY_ID or "").strip()
        sk = (settings.AWS_SECRET_ACCESS_KEY or "").strip()
        token = (getattr(settings, "AWS_SESSION_TOKEN", None) or os.getenv("AWS_SESSION_TOKEN", "")).strip()

        if ak and sk:
            kwargs["aws_access_key_id"] = ak
            kwargs["aws_secret_access_key"] = sk
            if token:
                kwargs["aws_session_token"] = token
            elif ak.startswith("AKIA"):
                kwargs["aws_session_token"] = None

        return boto3.client("translate", **kwargs)
    except Exception as e:
        log.warning(f"[Translation] Failed to create boto3 Translate client: {e}")
        return None


class TranslationService:
    """
    Dual-Engine Translation Service for Indian and Global Languages.
    Primary: Amazon Translate (boto3)
    Fallback: Gemini 2.5 Flash (google-genai)
    """

    def __init__(self):
        self._aws_client = None

    @property
    def aws_client(self):
        if self._aws_client is None:
            self._aws_client = _get_aws_translate_client()
        return self._aws_client

    def translate_to_english(
        self,
        text: str,
        source_lang: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Translates inbound user crisis message into English for downstream
        Presidio entity sanitization, OpenSearch hybrid retrieval, and rule matching.

        Returns:
            Tuple[str, str]: (english_text, detected_language_code)
        """
        if not text or not text.strip():
            return "", source_lang or "en"

        clean_text = text.strip()
        normalized_source = (source_lang or "").strip().lower()

        # Instant passthrough if explicitly English
        if normalized_source == "en":
            return clean_text, "en"

        # 1. Attempt Primary: Amazon Translate
        if self.aws_client:
            try:
                lang_code = normalized_source if normalized_source in SUPPORTED_LANGUAGES else "auto"
                res = self.aws_client.translate_text(
                    Text=clean_text,
                    SourceLanguageCode=lang_code,
                    TargetLanguageCode="en"
                )
                translated = res.get("TranslatedText", clean_text)
                detected = res.get("SourceLanguageCode", normalized_source or "en")
                log.info(f"[Translation] AWS Translate: {detected} -> en (length: {len(clean_text)})")
                return translated, detected
            except (ClientError, BotoCoreError) as ce:
                log.warning(f"[Translation] AWS Translate failed ({ce}); falling back to Gemini.")
            except Exception as e:
                log.warning(f"[Translation] Unexpected AWS Translate error ({e}); falling back to Gemini.")

        # 2. Attempt Fallback: Gemini 2.5 Flash
        return self._gemini_translate_to_english(clean_text, normalized_source)

    def translate_from_english(
        self,
        english_text: str,
        target_lang: str
    ) -> str:
        """
        Translates outbound assistant English response into the applicant's
        chosen native language (Devanagari, Tamil, Bengali, Arabic, Spanish, etc.).

        Returns:
            str: Native script translated response.
        """
        if not english_text or not english_text.strip():
            return ""

        clean_text = english_text.strip()
        normalized_target = (target_lang or "en").strip().lower()

        if normalized_target == "en":
            return clean_text

        # 1. Attempt Primary: Amazon Translate
        if self.aws_client:
            try:
                res = self.aws_client.translate_text(
                    Text=clean_text,
                    SourceLanguageCode="en",
                    TargetLanguageCode=normalized_target
                )
                translated = res.get("TranslatedText", clean_text)
                log.info(f"[Translation] AWS Translate: en -> {normalized_target} (length: {len(clean_text)})")
                return translated
            except (ClientError, BotoCoreError) as ce:
                log.warning(f"[Translation] AWS Translate outbound failed ({ce}); falling back to Gemini.")
            except Exception as e:
                log.warning(f"[Translation] Unexpected AWS Translate outbound error ({e}); falling back to Gemini.")

        # 2. Attempt Fallback: Gemini 2.5 Flash
        return self._gemini_translate_from_english(clean_text, normalized_target)

    def _gemini_translate_to_english(self, text: str, hint_lang: Optional[str]) -> Tuple[str, str]:
        """Translates text to English using Gemini 2.5 Flash with language detection."""
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            
            hint_str = f"The input is likely in language '{hint_lang}'." if hint_lang else "Detect the language automatically."
            prompt = (
                f"You are a professional multilingual aid intake translator. {hint_str}\n"
                "Translate the user message into natural, grammatically correct English.\n"
                "Preserve all specific details: dollar amounts, rents, household sizes, locations/boroughs, and benefit names.\n"
                "On the first line output: DETECTED_LANG=<2_letter_iso_code>\n"
                "On the remaining lines output ONLY the English translation.\n\n"
                f"Message: {text}"
            )

            res = client.models.generate_content(
                model=settings.PRIMARY_LLM_MODEL,
                contents=prompt
            )
            raw = (res.text or "").strip()
            lines = raw.splitlines()

            detected_lang = hint_lang or "en"
            content_start = 0
            if lines and lines[0].startswith("DETECTED_LANG="):
                detected_lang = lines[0].replace("DETECTED_LANG=", "").strip().lower()[:2]
                content_start = 1

            english_body = "\n".join(lines[content_start:]).strip()
            if not english_body:
                english_body = text

            log.info(f"[Translation] Gemini fallback: {detected_lang} -> en")
            return english_body, detected_lang
        except Exception as e:
            log.error(f"[Translation] Gemini inbound translation fallback failed: {e}")
            return text, hint_lang or "en"

    def _gemini_translate_from_english(self, english_text: str, target_lang: str) -> str:
        """Translates English response back to applicant's native language using Gemini."""
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            
            target_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
            prompt = (
                f"You are an empathetic, clear Community Aid Navigator translating official NYC emergency aid assistance into {target_name} ({target_lang}).\n"
                f"Translate the following English response into fluent, respectful, natural {target_name}.\n"
                "Maintain formatting, program acronyms (e.g. SNAP, SCRIE, DRIE), bullet points, and dollar figures intact.\n"
                "Output ONLY the translated text in the native script. Do not include commentary or markdown quotes.\n\n"
                f"English Response:\n{english_text}"
            )

            res = client.models.generate_content(
                model=settings.PRIMARY_LLM_MODEL,
                contents=prompt
            )
            translated = (res.text or "").strip()
            if translated.startswith("```") and translated.endswith("```"):
                lines = translated.split("\n")
                translated = "\n".join(lines[1:-1]).strip()
            
            if not translated:
                return english_text

            log.info(f"[Translation] Gemini fallback: en -> {target_lang}")
            return translated
        except Exception as e:
            log.error(f"[Translation] Gemini outbound translation fallback failed: {e}")
            return english_text

    def translate_batch(
        self,
        texts: List[str],
        target_lang: str
    ) -> Dict[str, str]:
        """
        Translates a batch of English phrases into the target language.
        Primary: Amazon Translate (boto3)
        Fallback: Gemini 2.5 Flash batch prompt
        """
        if not texts:
            return {}

        normalized_target = (target_lang or "en").strip().lower()
        if normalized_target == "en":
            return {t: t for t in texts}

        results: Dict[str, str] = {}

        # 1. Attempt Amazon Translate
        if self.aws_client:
            try:
                for t in texts:
                    if not t or not t.strip():
                        results[t] = t
                        continue
                    clean = t.strip()
                    res = self.aws_client.translate_text(
                        Text=clean,
                        SourceLanguageCode="en",
                        TargetLanguageCode=normalized_target
                    )
                    results[t] = res.get("TranslatedText", t)
                log.info(f"[Translation] AWS Translate batch: translated {len(results)} items into {normalized_target}")
                return results
            except (ClientError, BotoCoreError) as ce:
                log.warning(f"[Translation] AWS Translate batch failed ({ce}); falling back to Gemini.")
            except Exception as e:
                log.warning(f"[Translation] Unexpected AWS Translate batch error ({e}); falling back to Gemini.")

        # 2. Attempt Gemini fallback
        return self._gemini_translate_batch(texts, normalized_target)

    def _gemini_translate_batch(
        self,
        texts: List[str],
        target_lang: str
    ) -> Dict[str, str]:
        """Translates a batch of phrases into target language using Gemini."""
        import json
        unique_texts = list(set(t for t in texts if t and t.strip()))
        if not unique_texts:
            return {t: t for t in texts}

        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            target_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

            prompt = (
                f"You are a professional Community Aid Navigator translating NYC emergency aid website UI phrases into {target_name} ({target_lang}).\n"
                "Translate each phrase into natural, respectful, and standard native terminology.\n"
                "Keep program acronyms (e.g. SNAP, SCRIE, HEAP) intact if standard in the target language.\n"
                "Output ONLY a valid JSON object where keys are the exact English phrases and values are their translated versions.\n"
                "Do not wrap in markdown or explanation.\n\n"
                f"Phrases:\n{json.dumps(unique_texts, ensure_ascii=False)}"
            )

            res = client.models.generate_content(
                model=settings.PRIMARY_LLM_MODEL,
                contents=prompt
            )
            raw = (res.text or "").strip()
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1]).strip()

            if "```" in raw:
                start_idx = raw.find("{")
                end_idx = raw.rfind("}")
                if start_idx != -1 and end_idx != -1:
                    raw = raw[start_idx:end_idx+1]

            parsed = json.loads(raw)
            results = {t: parsed.get(t, t) for t in texts}
            log.info(f"[Translation] Gemini batch translated {len(unique_texts)} phrases into {target_lang}")
            return results
        except Exception as e:
            log.error(f"[Translation] Gemini batch translation failed: {e}")
            # Fallback to single translations or original
            results = {}
            for t in texts:
                try:
                    results[t] = self._gemini_translate_from_english(t, target_lang)
                except Exception:
                    results[t] = t
            return results


translation_service = TranslationService()
