import { api } from "./api";
import type {
  AuditMetricsResponse,
  BiasAuditReport,
  TriggerAuditRequest,
} from "../types/audit";

export const auditService = {
  async getMetrics(): Promise<AuditMetricsResponse> {
    return api.get<AuditMetricsResponse>("/audit/metrics");
  },

  async triggerAudit(req: TriggerAuditRequest): Promise<BiasAuditReport> {
    return api.post<BiasAuditReport>("/audit/run", req);
  },

  async getReport(runId: string): Promise<Record<string, any>> {
    return api.get<Record<string, any>>(`/audit/reports/${runId}`);
  },
};
