from typing import Dict, Tuple, List, Optional
import re
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig


class PIISanitizer:
    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()
        self._add_custom_recognizers()

    def _add_custom_recognizers(self):
        # 1. NYC Case ID Pattern (e.g., HRA-1234567 or CASE-987654)
        case_pattern = Pattern(name="nyc_case_pattern", regex=r"(?i)\b(?:HRA|CASE|APP)[-_ ]?[0-9]{6,10}\b", score=0.85)
        case_recognizer = PatternRecognizer(supported_entity="NYC_CASE_ID", patterns=[case_pattern])
        self.analyzer.registry.add_recognizer(case_recognizer)

        # 2. NY Medicaid / Benefit Client Identification Number (CIN) e.g., AB12345C
        cin_pattern = Pattern(name="ny_cin_pattern", regex=r"\b[A-Z]{2}[0-9]{5}[A-Z]\b", score=0.85)
        cin_recognizer = PatternRecognizer(supported_entity="NY_CIN_ID", patterns=[cin_pattern])
        self.analyzer.registry.add_recognizer(cin_recognizer)

    def sanitize(self, text: str, language: str = "en") -> Tuple[str, Dict[str, str]]:
        """
        Analyzes and pseudonymizes text.
        Returns:
            sanitized_text: Text with PII replaced by placeholders (e.g. <PERSON_1>, <PHONE_1>)
            vault: Dictionary mapping placeholder -> original sensitive value
        """
        if not text or not text.strip():
            return text, {}

        results = self.analyzer.analyze(
            text=text,
            language=language,
            entities=[
                "PERSON",
                "PHONE_NUMBER",
                "EMAIL_ADDRESS",
                "US_SSN",
                "LOCATION",
                "NYC_CASE_ID",
                "NY_CIN_ID"
            ]
        )

        # Filter out general NYC borough names so we don't accidentally redact location context
        borough_whitelist = {"brooklyn", "queens", "bronx", "manhattan", "staten island", "new york", "nyc"}
        filtered_results = []
        for res in results:
            entity_val = text[res.start:res.end].lower().strip()
            if res.entity_type == "LOCATION" and entity_val in borough_whitelist:
                continue
            filtered_results.append(res)

        vault: Dict[str, str] = {}
        entity_counters: Dict[str, int] = {}

        # Sort from right to left to perform safe text substitution
        sorted_results = sorted(filtered_results, key=lambda x: x.start, reverse=True)
        sanitized_chars = list(text)

        for res in sorted_results:
            orig_val = text[res.start:res.end]
            etype = res.entity_type
            entity_counters[etype] = entity_counters.get(etype, 0) + 1
            placeholder = f"<{etype}_{entity_counters[etype]}>"
            
            sanitized_chars[res.start:res.end] = list(placeholder)
            vault[placeholder] = orig_val

        sanitized_text = "".join(sanitized_chars)
        return sanitized_text, vault

    def rehydrate(self, sanitized_text: str, vault: Dict[str, str]) -> str:
        """
        Restores original entities into text using the local vault.
        """
        result = sanitized_text
        for placeholder, original in vault.items():
            result = result.replace(placeholder, original)
        return result


# Global singleton instance
sanitizer = PIISanitizer()
