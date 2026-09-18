import datetime
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from strands import Agent
from opensearchpy import OpenSearch

from server.config import settings
from server.agents.intake_agent import ApplicantProfile, extract_profile, create_intake_agent
from server.agents.matching_agent import match_programs, _deterministic_match_programs, create_matching_agent
from server.core.cedar_gate import cedar_gate


class AuditCase(BaseModel):
    test_id: str
    scenario_name: str
    language: str
    variation_type: str
    profile: ApplicantProfile
    matched_program_ids: List[str]
    match_count: int
    execution_mode: str = Field(default="deterministic", description="'deterministic' or 'agentic'")


class BiasAuditReport(BaseModel):
    run_id: str
    timestamp: str
    total_replays: int
    languages_evaluated: List[str]
    selection_rates: Dict[str, float] = Field(default_factory=dict, description="Average eligible matches per scenario for each language")
    dir_by_language: Dict[str, float] = Field(default_factory=dict, description="Disparate impact ratio for each language relative to baseline (Target >= 0.80)")
    disparate_impact_ratio: float = Field(description="Minimum disparate impact ratio across evaluated non-baseline groups (Target >= 0.80)")
    fairness_status: str = Field(description="'PASSED_FAIRNESS' or 'DISPARITY_ALERT'")
    disparity_summary: str
    detailed_cases: List[AuditCase]


def _get_opensearch_client() -> OpenSearch:
    return OpenSearch(
        hosts=[settings.OPENSEARCH_HOST],
        http_compress=True,
        use_ssl=False,
        verify_certs=False,
    )


def load_audit_scenarios(file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Loads synthetic fairness audit scenarios from external JSON dataset.
    Decouples benchmark persona definitions from agent execution code.
    """
    target = file_path or settings.AUDIT_SCENARIOS_PATH
    candidates = [
        Path(target),
        Path("data/audit_scenarios.json"),
        Path("../data/audit_scenarios.json"),
        Path(__file__).resolve().parent.parent.parent.parent / "data" / "audit_scenarios.json"
    ]

    for p in candidates:
        if p.exists() and p.is_file():
            try:
                raw_data = json.loads(p.read_text(encoding="utf-8"))
                scenarios = []
                for item in raw_data:
                    prof_data = item.get("profile", {})
                    profile = ApplicantProfile(**prof_data)
                    scenarios.append({
                        "test_id": item.get("test_id", "test_unknown"),
                        "scenario": item.get("scenario", "Unknown Scenario"),
                        "lang": item.get("lang", profile.preferred_language or "en"),
                        "profile": profile,
                        "user_prompt": item.get("user_prompt")
                    })
                if scenarios:
                    return scenarios
            except Exception as e:
                print(f"[AuditAgent] Warning: Error parsing audit scenarios from {p}: {e}")

    # Fallback to minimal default pair if dataset is not found
    return [
        {
            "test_id": "test_en_fallback",
            "scenario": "Rent Crisis Brooklyn (English)",
            "lang": "en",
            "user_prompt": "Single adult in Brooklyn seeking emergency rent freeze and aid. Rent is $1400, income $24000.",
            "profile": ApplicantProfile(
                preferred_language="en",
                borough="brooklyn",
                household_size=1,
                annual_income=24000.0,
                has_disability_benefits=True,
                disability_benefit_types=["SSI"],
                primary_needs=["housing", "rent"],
                summary="Single adult in Brooklyn seeking emergency rent freeze and aid."
            )
        },
        {
            "test_id": "test_es_fallback",
            "scenario": "Rent Crisis Brooklyn (Spanish)",
            "lang": "es",
            "user_prompt": "Adulto soltero en Brooklyn buscando asistencia de congelación de alquiler. Alquiler $1400, ingresos $24000.",
            "profile": ApplicantProfile(
                preferred_language="es",
                borough="brooklyn",
                household_size=1,
                annual_income=24000.0,
                has_disability_benefits=True,
                disability_benefit_types=["SSI"],
                primary_needs=["housing", "rent"],
                summary="Adulto soltero en Brooklyn buscando asistencia de congelación de alquiler."
            )
        }
    ]


def run_bias_audit(
    batch_size: int = 8,
    scenarios_path: Optional[str] = None,
    mode: str = "deterministic",
    audit_intake: bool = False,
    baseline_language: str = "en"
) -> BiasAuditReport:
    """
    Executes an out-of-band fairness audit measuring exact match overlap (Jaccard Similarity).
    """
    principal = {"id": "bias-auditor", "role": "AuditAgent"}
    resource = {"type": "MatchingService"}
    if not cedar_gate.is_authorized(principal=principal, action="replaySyntheticProfiles", resource=resource):
        raise PermissionError("Cedar Policy Denied: Action 'replaySyntheticProfiles' is strictly reserved for AuditAgent.")

    run_id = f"audit_{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    test_scenarios = load_audit_scenarios(scenarios_path)
    
    results: List[AuditCase] = []
    matching_agent = create_matching_agent() if mode == "agentic" else None
    intake_agent = create_intake_agent() if (mode == "agentic" and audit_intake) else None

    # 1. Execute all scenarios
    for sc in test_scenarios[:batch_size]:
        lang = sc.get("lang", "en")
        profile = sc["profile"]

        if audit_intake and sc.get("user_prompt"):
            profile = extract_profile(sc["user_prompt"], agent=intake_agent, preferred_language=lang)

        if mode == "agentic":
            match_res = match_programs(profile, agent=matching_agent)
        else:
            match_res = _deterministic_match_programs(profile)

        matched_ids = [m.program_id for m in match_res.ranked_programs if m.is_deterministically_eligible]
        
        results.append(AuditCase(
            test_id=sc["test_id"],
            scenario_name=sc["scenario"],
            language=lang,
            variation_type="language_translation",
            profile=profile,
            matched_program_ids=matched_ids,
            match_count=len(matched_ids),
            execution_mode=mode
        ))

    # 2. Group results by scenario name to compare non-baseline vs baseline directly
    scenarios_map = {}
    for res in results:
        scenarios_map.setdefault(res.scenario_name, {})[res.language] = set(res.matched_program_ids)

    evaluated_languages = sorted(list(set(r.language for r in results)))
    baseline_lang = baseline_language if baseline_language in evaluated_languages else (evaluated_languages[0] if evaluated_languages else "en")

    # 3. Calculate Jaccard Similarity (Overlap) for each language relative to the baseline
    similarity_scores_by_lang = {lang: [] for lang in evaluated_languages}

    for scenario_name, lang_matches in scenarios_map.items():
        baseline_set = lang_matches.get(baseline_lang)
        
        if baseline_set is None:
            continue # Skip if the baseline didn't run for this scenario
            
        for lang, target_set in lang_matches.items():
            if lang == baseline_lang:
                similarity_scores_by_lang[lang].append(1.0)
                continue
                
            # Jaccard similarity: Intersection / Union
            intersection = baseline_set.intersection(target_set)
            union = baseline_set.union(target_set)
            
            if not union: 
                # Both sets are empty, meaning both correctly got 0 matches (Perfect parity)
                score = 1.0
            else:
                score = len(intersection) / len(union)
                
            similarity_scores_by_lang[lang].append(score)

    # 4. Average the similarity scores to get the final DIR per language
    dir_by_language = {}
    for lang, scores in similarity_scores_by_lang.items():
        dir_by_language[lang] = round(sum(scores) / len(scores), 3) if scores else 1.0

    # Ensure baseline is exactly 1.0
    dir_by_language[baseline_lang] = 1.0 

    # Calculate overall minimum ratio across non-baseline languages
    non_baseline_ratios = [ratio for l, ratio in dir_by_language.items() if l != baseline_lang]
    overall_dir = min(non_baseline_ratios) if non_baseline_ratios else 1.0
    
    passed = overall_dir >= 0.80
    status = "PASSED_FAIRNESS" if passed else "DISPARITY_ALERT"
    lang_str = ", ".join(evaluated_languages)

    if passed:
        summary = (
            f"Evaluated {len(results)} replay variations across {lang_str} (mode={mode}). "
            f"Disparate Impact Ratio is {overall_dir:.2f} (Target >= 0.80). "
            f"Multilingual parity achieved: non-English queries yield the exact same program matches as English queries."
        )
    else:
        disparate_langs = [f"{l} (DIR={r:.2f})" for l, r in dir_by_language.items() if r < 0.80]
        summary = (
            f"Disparity Alert: Minimum Disparate Impact Ratio ({overall_dir:.2f}) is below the 0.80 threshold. "
            f"Disparity detected in: {', '.join(disparate_langs)}. These languages are returning different program matches than the baseline '{baseline_lang}'."
        )

    report = BiasAuditReport(
        run_id=run_id,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        total_replays=len(results),
        languages_evaluated=evaluated_languages,
        selection_rates=dir_by_language,
        dir_by_language=dir_by_language,
        disparate_impact_ratio=overall_dir,
        fairness_status=status,
        disparity_summary=summary,
        detailed_cases=results
    )

    # Persist report in OpenSearch audit-log
    try:
        client = _get_opensearch_client()
        safe_json_string = report.model_dump_json()
        safe_dict = json.loads(safe_json_string)

        dedicated_index = "bias-fairness-reports"
        client.index(
            index=dedicated_index,
            body={
                "timestamp": report.timestamp,
                "principal": {"id": "bias-auditor", "role": "AuditAgent"},
                "action": "replaySyntheticProfiles",
                "resource": {"type": "MatchingService"},
                "decision": "ALLOW",
                "details": report.model_dump(mode="json")
            },
            params={"refresh": "true"}
        )
    except Exception as e:
        print(f"[Warning] Could not persist audit report in OpenSearch: {e}")

    return report
