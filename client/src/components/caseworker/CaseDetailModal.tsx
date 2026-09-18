import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Shield,
  Building2,
  Calendar,
  DollarSign,
  Home,
  Eye,
  FileDown,
  AlertCircle,
  User,
  HeartHandshake,
} from "lucide-react";
import { caseworkerService } from "../../services/caseworkerService";
import type { CaseDossier } from "../../types/caseworker";

interface CaseDetailModalProps {
  caseId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRevealPii: (caseId: string) => void;
  onExportCase: (caseId: string) => void;
  cachedCase?: CaseDossier | null;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  caseId,
  isOpen,
  onClose,
  onRevealPii,
  onExportCase,
  cachedCase,
}) => {
  const [caseData, setCaseData] = useState<CaseDossier | null>(cachedCase || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && caseId) {
      if (cachedCase && cachedCase.case_id === caseId) {
        setCaseData(cachedCase);
      }
      setIsLoading(true);
      setErrorMsg(null);
      caseworkerService
        .getCaseDetails(caseId)
        .then((data) => {
          setCaseData(data);
        })
        .catch((err) => {
          console.warn(`Failed to fetch live case details for ${caseId}:`, err);
          if (cachedCase) {
            setCaseData(cachedCase);
          } else {
            setErrorMsg(
              err?.message ||
                "Failed to retrieve case details from Redis. Ensure case belongs to your authorized agency."
            );
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setCaseData(null);
      setErrorMsg(null);
    }
  }, [isOpen, caseId, cachedCase]);

  if (!isOpen || !caseId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Client Case Dossier
                </h3>
                <span className="font-mono text-xs font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded">
                  {caseId}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <span>Agency Scope:</span>
                <span className="font-mono text-blue-300 font-semibold flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {caseData?.org_id || "..."}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scroll">
          {isLoading && !caseData && (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              Fetching case record via GET /caseworker/cases/{caseId}...
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <strong>Retrieval Error:</strong> {errorMsg}
              </div>
            </div>
          )}

          {caseData && (
            <div className="space-y-5 animate-fade-in">
              {/* Client Identifier Banner */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">
                        {caseData.client_name_masked || "<PERSON_1>"}
                      </span>
                      <span className="inline-flex items-center text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                        <Shield className="w-2.5 h-2.5 mr-1" />
                        Presidio De-Identified
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Real legal identity encrypted in Presidio Vault.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRevealPii(caseData.case_id)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Audited PII Reveal</span>
                </button>
              </div>

              {/* Case Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Intake Date & Officer
                  </span>
                  <div className="flex items-center gap-1.5 text-white font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(caseData.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Officer: {caseData.created_by}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Jurisdiction / Borough
                  </span>
                  <div className="text-white font-semibold text-sm">
                    {caseData.profile?.borough || "NYC Area"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Language: {caseData.profile?.preferred_language?.toUpperCase() || "EN"}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Financial Profile
                  </span>
                  <div className="flex items-center gap-1 text-white font-semibold">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>${caseData.profile?.annual_income?.toLocaleString() || 0} / year</span>
                  </div>
                  {caseData.profile?.monthly_rent && (
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Home className="w-3 h-3 text-slate-400" />
                      <span>Rent: ${caseData.profile.monthly_rent.toLocaleString()} / mo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Disability & Special Demographics */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-200">Disability / SSI Status:</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {caseData.profile?.has_disability_benefits
                      ? "Applicant or family member has verified active disability/SSI benefits."
                      : "No active disability benefits reported."}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    caseData.profile?.has_disability_benefits
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {caseData.profile?.has_disability_benefits ? "Active Disability" : "Standard"}
                </span>
              </div>

              {/* Primary Needs */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-blue-400" />
                  <span>Identified Benefit Needs</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {caseData.profile?.primary_needs && caseData.profile.primary_needs.length > 0 ? (
                    caseData.profile.primary_needs.map((need) => (
                      <span
                        key={need}
                        className="px-3 py-1 rounded-xl text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm"
                      >
                        {need}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No specific needs tagged</span>
                  )}
                </div>
              </div>

              {/* Sanitized Narrative */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Certified Intake Narrative (Sanitized)
                </span>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 text-xs text-slate-200 leading-relaxed">
                  {caseData.sanitized_summary || caseData.profile?.summary || "No narrative available"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>

          {caseData && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRevealPii(caseData.case_id);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Audited PII Reveal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExportCase(caseData.case_id);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Packet</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
