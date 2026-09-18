import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  ShieldCheck,
  Play,
  Database,
  Lock,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { adminService } from "../services/adminService";
import type { HealthStatus, BiasAuditReport } from "../types/audit";
import { ClusterHealthGrid } from "../components/admin/ClusterHealthGrid";
import { AuditRunnerModal } from "../components/admin/AuditRunnerModal";
import { ReseedModal } from "../components/admin/ReseedModal";

export const AdminView: React.FC = () => {
  const { user } = useAuth();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toISOString());
  const [backendNotice, setBackendNotice] = useState<string | null>(null);

  // Modals
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isReseedModalOpen, setIsReseedModalOpen] = useState(false);
  const [lastCompletedAudit, setLastCompletedAudit] = useState<BiasAuditReport | null>(null);

  const fetchHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    setBackendNotice(null);
    try {
      const data = await adminService.getHealth();
      setHealth(data);
      setLastChecked(new Date().toISOString());
    } catch (err: any) {
      console.warn("Cluster health fetch returned:", err);
      // Fallback local status
      setHealth({
        status: "healthy",
        environment: "development",
        opensearch: "green",
        redis: "connected",
        primary_llm_model: "gemini-2.5-pro",
      });
      setLastChecked(new Date().toISOString());
      setBackendNotice("Notice: Connected to client dev mode. Backend endpoint reported: " + (err?.message || "offline"));
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
              System Operations & Infrastructure
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Administrator Control Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Authenticated administrator: <strong className="text-slate-200">{user?.name || "Ops Admin"}</strong> •
            Role scope: <strong className="text-amber-300 font-mono">Role::"Admin"</strong> (Root Cluster Control)
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Trigger Bias Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReseedModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Re-Seed OpenSearch</span>
          </button>
        </div>
      </div>

      {/* Admin Privilege Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-900/30 via-slate-900 to-orange-900/20 border border-amber-500/30 flex items-start sm:items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
        <div className="text-xs text-slate-300">
          <strong className="text-white">Full System Privilege:</strong> As a verified System Administrator,
          you have elevated authority to monitor service health probes, execute on-demand synthetic bias audits,
          and re-seed OpenSearch hybrid vector indexes from raw CSV catalogs under AWS Cedar policy governance.
        </div>
      </div>

      {/* Backend Notice if dev fallback */}
      {backendNotice && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2.5 text-xs text-blue-300">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{backendNotice}</span>
        </div>
      )}

      {/* Live Cluster Probes */}
      <ClusterHealthGrid
        health={health}
        isLoading={isLoadingHealth}
        onRefresh={fetchHealth}
        lastChecked={lastChecked}
      />

      {/* Operations Quick Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Bias Audit Trigger */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-xl">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
              <Play className="w-5 h-5 fill-purple-400" />
            </div>
            <h3 className="text-base font-bold text-white">
              On-Demand Algorithmic Fairness Replay
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Initiate an automated synthetic test suite to evaluate Disparate Impact Ratios (DIR) across
              14 Indian and Global languages. Output is indexed directly into OpenSearch for Policy Analyst review.
            </p>
          </div>

          {lastCompletedAudit && (
            <div className="my-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span>Latest Manual Run: {lastCompletedAudit.run_id}</span>
                <span className="text-emerald-400">DIR: {lastCompletedAudit.disparate_impact_ratio.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Status: {lastCompletedAudit.fairness_status} • {lastCompletedAudit.total_replays} replays
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Bias Audit Console</span>
          </button>
        </div>

        {/* Panel 2: Vector Re-Seed */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-xl">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              OpenSearch Vector Embeddings Catalog Re-Seed
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Re-parse `data/aid_programs_populated.csv`, generate 768-dimensional text embeddings,
              and recreate the KNN vector index and normalization pipeline for the aid matching agent.
            </p>
          </div>

          <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Index: aid-programs (KNN HNSW)</span>
            </div>
            <div>Source: 55 Official NYC & NY State Benefit Programs</div>
          </div>

          <button
            type="button"
            onClick={() => setIsReseedModalOpen(true)}
            className="mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Database className="w-4 h-4" />
            <span>Open Re-Seed Console</span>
          </button>
        </div>
      </div>

      {/* AWS Cedar Security Engine Policy Architecture Overview */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              AWS Cedar Authorization Policies in Active Enforcement
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
            5 Formal Policies Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
            <div className="font-bold text-emerald-300">Policy #1: Public Citizen</div>
            <p className="text-[11px] text-slate-400">
              Permits searchProgramCatalog, startIntake, continueIntake, and resetSession. Zero PII storage.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
            <div className="font-bold text-blue-300">Policy #2: Org-Scoped Caseworker</div>
            <p className="text-[11px] text-slate-400">
              Strictly confines readApplicantRecord & draftApplication to matching `resource.orgId == principal.orgId`.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
            <div className="font-bold text-amber-300">Policy #3: Audited PII Vault Reveal</div>
            <p className="text-[11px] text-slate-400">
              Allows readPiiVault only for caseworkers with mandatory structured audit trail logging.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
            <div className="font-bold text-purple-300">Policy #4: Policy Analyst</div>
            <p className="text-[11px] text-slate-400">
              Permits readAuditMetrics and inspectFairness. Condition: `resource.containsPII == false`.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
            <div className="font-bold text-cyan-300">Policy #5: Root System Admin</div>
            <p className="text-[11px] text-slate-400">
              Permits runAuditManually, manageIndices, and full cluster administration.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 space-y-1">
            <div className="font-bold text-rose-300">Default: Explicit Deny</div>
            <p className="text-[11px] text-slate-400">
              Any request not matched by an explicit permit is rejected by the Cedar engine.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AuditRunnerModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onAuditCompleted={(report) => {
          setLastCompletedAudit(report);
          fetchHealth();
        }}
      />

      <ReseedModal
        isOpen={isReseedModalOpen}
        onClose={() => setIsReseedModalOpen(false)}
        onSuccess={fetchHealth}
      />
    </div>
  );
};
