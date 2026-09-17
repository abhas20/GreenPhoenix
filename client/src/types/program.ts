export interface ProgramMatch {
  program_id: string;
  name: string;
  organization: string;
  category: string;
  match_confidence: number;
  is_deterministically_eligible: boolean;
  plain_language_reason: string;
  passed_criteria: string[];
  potential_blockers: string[];
  unverifiable_checks: string[];
  application_url: string;
  application_method: string;
}

export interface MatchingResult {
  ranked_programs: ProgramMatch[];
  total_candidates_evaluated: number;
  unmatched_notes?: string | null;
}

export interface DocumentItem {
  document_name: string;
  description: string;
  required_for_programs: string[];
  tips_for_applicant: string;
}

export interface ExcludedProgram {
  program_id: string;
  reason: string;
}

export interface ApplicationDraft {
  selected_programs: string[];
  consolidated_checklist: DocumentItem[];
  sample_hardship_statement: string;
  next_steps: string[];
  excluded_programs: ExcludedProgram[];
}

export interface ProgramDocument {
  program_id: string;
  name: string;
  organization: string;
  category: string;
  region: string;
  description: string;
  eligible_household_size_min?: number | null;
  eligible_household_size_max?: number | null;
  income_threshold?: string | null;
  languages_supported?: string[];
  required_documents?: string[];
  application_url?: string;
  application_method?: string;
  contact_phone?: string;
  last_verified_date?: string;
  source_url?: string;
  eligibility_rules?: Record<string, any>;
}

export interface EligibilityCheckRequest {
  annual_income?: number | null;
  household_size?: number | null;
  age?: number | null;
  region?: string | null;
  has_disability_benefits?: boolean | null;
  disability_benefit_types?: string[] | null;
  has_children?: boolean | null;
  is_homeowner?: boolean | null;
  monthly_rent?: number | null;
}

export interface EligibilityCheckResponse {
  program_id: string;
  is_eligible: boolean;
  evaluation_mode: string;
  reasons: string[];
  passed_criteria: string[];
  failing_criteria: string[];
}
