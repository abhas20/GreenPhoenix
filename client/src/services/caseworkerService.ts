import { api } from "./api";
import type {
  CaseDossier,
  CreateCaseRequest,
  RevealPiiResponse,
  ExportCaseResponse,
} from "../types/caseworker";

export const caseworkerService = {
  async listCases(): Promise<CaseDossier[]> {
    return api.get<CaseDossier[]>("/caseworker/cases");
  },

  async createCase(req: CreateCaseRequest): Promise<CaseDossier> {
    return api.post<CaseDossier>("/caseworker/cases", req);
  },

  async getCaseDetails(caseId: string): Promise<CaseDossier> {
    return api.get<CaseDossier>(`/caseworker/cases/${caseId}`);
  },

  async revealPii(caseId: string): Promise<RevealPiiResponse> {
    return api.post<RevealPiiResponse>(`/caseworker/cases/${caseId}/reveal-pii`);
  },

  async exportCase(caseId: string): Promise<ExportCaseResponse> {
    return api.get<ExportCaseResponse>(`/caseworker/cases/${caseId}/export`);
  },
};
