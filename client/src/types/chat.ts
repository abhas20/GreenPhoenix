import type { MatchingResult, ApplicationDraft } from "./program";

export interface ApplicantProfile {
  preferred_language?: string;
  borough?: string | null;
  household_size?: number | null;
  annual_income?: number | null;
  monthly_rent?: number | null;
  age?: number | null;
  has_disability_benefits?: boolean | null;
  disability_benefit_types?: string[] | null;
  has_children_under_5?: boolean | null;
  is_homeowner?: boolean | null;
  primary_needs: string[];
  missing_critical_fields?: string[];
  clarification_question?: string | null;
  summary: string;
}

export interface ChatTurnRequest {
  message: string;
}

export interface ChatTurnResponse {
  session_id: string;
  reply_message: string;
  clarification_needed: boolean;
  applicant_profile: ApplicantProfile;
  matching_result?: MatchingResult | null;
  application_draft?: ApplicationDraft | null;
}

export interface SessionHistoryItem {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface SessionState {
  session_id: string;
  applicant_profile: ApplicantProfile;
  matching_result?: MatchingResult | null;
  application_draft?: ApplicationDraft | null;
  history: SessionHistoryItem[];
  last_matched_snapshot?: Record<string, any> | null;
  pii_vault: Record<string, string>;
}
