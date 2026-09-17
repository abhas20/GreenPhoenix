export interface AuditCase {
  test_id: string;
  scenario_id?: string;
  scenario_name: string;
  language: string;
  variation_type: string;
  matched_program_ids: string[];
  match_count: number;
  execution_mode: string;
  error?: string | null;
}

export interface BiasAuditReport {
  run_id: string;
  timestamp: string;
  total_replays: number;
  languages_evaluated: string[];
  selection_rates: Record<string, number>;
  dir_by_language?: Record<string, number>;
  disparate_impact_ratio: number;
  fairness_status: "PASSED_FAIRNESS" | "DISPARITY_ALERT" | string;
  disparity_summary: string;
  detailed_cases: AuditCase[];
}

export interface TriggerAuditRequest {
  batch_size: number;
  mode: "deterministic" | "agentic";
  audit_intake: boolean;
}

export interface AuditMetricsHistoryItem {
  run_id: string;
  timestamp: string;
  fairness_status: string;
  disparate_impact_ratio: number;
  languages_evaluated: string[];
  selection_rates: Record<string, number>;
  disparity_summary: string;
}

export interface AuditMetricsResponse {
  total_audit_runs: number;
  latest_run: AuditMetricsHistoryItem | null;
  recent_runs: AuditMetricsHistoryItem[];
}

export interface HealthStatus {
  status: string;
  environment: string;
  opensearch: string;
  redis: string;
  primary_llm_model: string;
}
