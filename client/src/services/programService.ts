import { api } from "./api";
import type {
  ProgramDocument,
  EligibilityCheckRequest,
  EligibilityCheckResponse,
} from "../types/program";

export const programService = {
  async searchPrograms(query: string, limit = 6, includeClosed = false): Promise<ProgramDocument[]> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
      include_closed: includeClosed.toString(),
    });
    return api.get<ProgramDocument[]>(`/programs/search?${params.toString()}`);
  },

  async getProgramDetails(programId: string): Promise<ProgramDocument> {
    return api.get<ProgramDocument>(`/programs/${programId}`);
  },

  async checkEligibility(
    programId: string,
    req: EligibilityCheckRequest
  ): Promise<EligibilityCheckResponse> {
    return api.post<EligibilityCheckResponse>(
      `/programs/${programId}/check-eligibility`,
      req
    );
  },

  async getRequirements(programId: string): Promise<Record<string, any>> {
    return api.get<Record<string, any>>(`/programs/${programId}/requirements`);
  },
};
