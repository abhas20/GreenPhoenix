import { api } from "./api";
import type { HealthStatus } from "../types/audit";

export const adminService = {
  async getHealth(): Promise<HealthStatus> {
    return api.get<HealthStatus>("/health");
  },

  async reseedIndices(): Promise<{ status: string; message: string }> {
    return api.post<{ status: string; message: string }>("/admin/indices/reseed");
  },
};
