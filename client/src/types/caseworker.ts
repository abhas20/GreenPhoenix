import type { ApplicantProfile } from "./chat";

export interface CreateCaseRequest {
  client_name: string;
  client_phone?: string | null;
  summary: string;
  borough: string;
  annual_income: number;
  monthly_rent?: number | null;
  has_disability_benefits?: boolean | null;
  primary_needs: string[];
}

export interface CaseDossier {
  case_id: string;
  org_id: string;
  created_by: string;
  created_at: string;
  client_name_masked: string;
  client_name_real?: string;
  client_phone?: string | null;
  sanitized_summary: string;
  profile: ApplicantProfile;
  pii_vault?: Record<string, string>;
}

export interface RevealPiiResponse {
  case_id: string;
  client_name: string;
  client_phone?: string | null;
  unmasked_summary: string;
  audit_logged: boolean;
}

export interface ExportCaseResponse {
  case_id: string;
  exported_at: string;
  case_data: CaseDossier & Record<string, any>;
}
