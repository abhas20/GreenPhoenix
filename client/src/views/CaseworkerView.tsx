import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Building2,
  ShieldCheck,
  Lock,
  Plus,
  Info,
  Database,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { caseworkerService } from "../services/caseworkerService";
import type { CaseDossier } from "../types/caseworker";
import { CaseQueueTable } from "../components/caseworker/CaseQueueTable";
import { CaseDetailModal } from "../components/caseworker/CaseDetailModal";
import { CreateCaseModal } from "../components/caseworker/CreateCaseModal";
import { PiiRevealModal } from "../components/caseworker/PiiRevealModal";
import { ExportPacketModal } from "../components/caseworker/ExportPacketModal";

// Offline fallback cases in case backend or Redis is not yet populated
const SAMPLE_CASES: CaseDossier[] = [
  {
    case_id: "case_4f92a101",
    org_id: "hra_nyc",
    created_by: "sjenkins_hra",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    client_name_masked: "<PERSON_1>",
    client_phone: null,
    sanitized_summary:
      "Applicant <PERSON_1>, phone <PHONE_1>. Client facing immediate eviction notice with 14-day cure deadline in Flatbush, Brooklyn. Monthly rent arrears $2,800. Needs One Shot Deal and emergency SNAP.",
    profile: {
      preferred_language: "en",
      borough: "Brooklyn",
      annual_income: 19400,
      monthly_rent: 1400,
      has_disability_benefits: false,
      primary_needs: ["One Shot Deal (Rental Arrears)", "SNAP Food Assistance"],
      missing_critical_fields: [],
      summary: "Single mother facing eviction with 2 dependent children.",
    },
  },
  {
    case_id: "case_8e31b79c",
    org_id: "hra_nyc",
    created_by: "sjenkins_hra",
    created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
    client_name_masked: "<PERSON_2>",
    client_phone: null,
    sanitized_summary:
      "Applicant <PERSON_2>, phone <PHONE_2>. Senior citizen living in South Bronx on fixed SSI income. Rent increased by 22% this quarter. Seeking SCRIE and HEAP winter heating voucher.",
    profile: {
      preferred_language: "en",
      borough: "Bronx",
      annual_income: 13200,
      monthly_rent: 1100,
      has_disability_benefits: true,
      primary_needs: ["SCRIE Senior Rent Exemption", "HEAP Energy Subsidy"],
      missing_critical_fields: [],
      summary: "Elderly applicant with disability seeking rent freeze.",
    },
  },
  {
    case_id: "case_c27a55d0",
    org_id: "queens_cbo",
    created_by: "crivera_cbo",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    client_name_masked: "<PERSON_1>",
    client_phone: null,
    sanitized_summary:
      "Applicant <PERSON_1>, phone <PHONE_1>. Immigrant family living in Jackson Heights seeking emergency food assistance and health insurance coverage.",
    profile: {
      preferred_language: "es",
      borough: "Queens",
      annual_income: 24000,
      monthly_rent: 1750,
      has_disability_benefits: false,
      primary_needs: ["SNAP Food Assistance", "Medicaid Health Coverage"],
      missing_critical_fields: [],
      summary: "Non-English speaking family in Queens requiring community advocate support.",
    },
  },
];

export const CaseworkerView: React.FC = () => {
  const { user, switchPersona } = useAuth();
  const orgId = user?.org_id || "hra_nyc";

  const [cases, setCases] = useState<CaseDossier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [revealTargetCaseId, setRevealTargetCaseId] = useState<string | null>(null);
  const [exportTargetCaseId, setExportTargetCaseId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setBackendError(null);
    try {
      const data = await caseworkerService.listCases();
      // If backend is active and returned cases
      setCases(data);
    } catch (err: any) {
      console.warn("Backend /caseworker/cases query failed or unseeded, using scoped samples:", err);
      setBackendError(
        "Notice: Connected to local demo fallback. Backend endpoint returned: " +
          (err?.message || "unreachable")
      );
      // Filter samples by active org_id to illustrate Cedar multi-tenant isolation!
      const scopedSamples = SAMPLE_CASES.filter((c) => c.org_id === orgId);
      setCases(scopedSamples);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleCaseCreated = (newCase: CaseDossier) => {
    setCases((prev) => [newCase, ...prev]);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">
              Caseworker Case Management Desk
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Client Dossiers & Intake Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Authenticated officer: <strong className="text-slate-200">{user?.name}</strong> •
            Assigned agency: <strong className="text-blue-300 font-mono">{orgId}</strong>
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Intake New Client Dossier</span>
          </button>
        </div>
      </div>

      {/* Multi-Tenant Cedar Demonstration Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 via-slate-900 to-indigo-900/20 border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-0.5">
            <div className="font-bold text-white flex items-center gap-2">
              <span>Cedar Multi-Tenant Organization Isolation Active</span>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                orgId: {orgId}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Under AWS Cedar Policy #2, caseworkers can <strong>only</strong> access client records
              belonging to their verified organization. Switch to another caseworker persona below to
              verify cross-organization barrier enforcement.
            </p>
          </div>
        </div>

        {/* Demo Switcher shortcut */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">Simulate Tenant:</span>
          {orgId === "hra_nyc" ? (
            <button
              type="button"
              onClick={() => switchPersona("cw_cbo")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Switch to Carlos Rivera (Queens CBO)"
            >
              <span>Switch to Queens CBO</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchPersona("cw_hra")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Switch to Sarah Jenkins (NYC HRA)"
            >
              <span>Switch to NYC HRA</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            Active Agency Dossiers
          </div>
          <div className="text-2xl font-extrabold text-white">{cases.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">Scoped to {orgId}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            Presidio Vault Footprint
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5" />
            <span>Sanitized</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Zero raw PII at rest</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            Cedar Policy Enforcement
          </div>
          <div className="text-2xl font-extrabold text-blue-400 flex items-center gap-1.5">
            <Lock className="w-5 h-5" />
            <span>Policies 2 & 3</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Org & PII boundaries</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            Data Storage Tier
          </div>
          <div className="text-2xl font-extrabold text-purple-400 flex items-center gap-1.5">
            <Database className="w-5 h-5" />
            <span>Redis + DDB</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">30-day eviction TTL</div>
        </div>
      </div>

      {/* Backend Notice if offline */}
      {backendError && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-3 text-xs text-amber-300">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{backendError}</span>
        </div>
      )}

      {/* Case Queue Table */}
      <CaseQueueTable
        cases={cases}
        isLoading={isLoading}
        orgId={orgId}
        onRefresh={loadCases}
        onOpenCreateModal={() => setIsCreateOpen(true)}
        onSelectCase={(caseId) => setSelectedCaseId(caseId)}
        onRevealPii={(caseId) => setRevealTargetCaseId(caseId)}
        onExportCase={(caseId) => setExportTargetCaseId(caseId)}
      />

      {/* Case Details Modal */}
      <CaseDetailModal
        caseId={selectedCaseId}
        isOpen={selectedCaseId !== null}
        onClose={() => setSelectedCaseId(null)}
        onRevealPii={(caseId) => setRevealTargetCaseId(caseId)}
        onExportCase={(caseId) => setExportTargetCaseId(caseId)}
        cachedCase={cases.find((c) => c.case_id === selectedCaseId) || null}
      />

      {/* Modals */}
      <CreateCaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        orgId={orgId}
        onCaseCreated={handleCaseCreated}
      />

      <PiiRevealModal
        caseId={revealTargetCaseId}
        isOpen={revealTargetCaseId !== null}
        onClose={() => setRevealTargetCaseId(null)}
        orgId={orgId}
      />

      <ExportPacketModal
        caseId={exportTargetCaseId}
        isOpen={exportTargetCaseId !== null}
        onClose={() => setExportTargetCaseId(null)}
        orgId={orgId}
      />
    </div>
  );
};
