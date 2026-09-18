import React, { useState, useEffect } from "react";
import {
  X,
  Eye,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Building2,
  Lock,
  Phone,
  UserCheck,
} from "lucide-react";
import { caseworkerService } from "../../services/caseworkerService";
import type { RevealPiiResponse } from "../../types/caseworker";

interface PiiRevealModalProps {
  caseId: string | null;
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
}

export const PiiRevealModal: React.FC<PiiRevealModalProps> = ({
  caseId,
  isOpen,
  onClose,
  orgId,
}) => {
  const [data, setData] = useState<RevealPiiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedAudit, setConfirmedAudit] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setData(null);
      setErrorMsg(null);
      setConfirmedAudit(false);
    }
  }, [isOpen, caseId]);

  if (!isOpen || !caseId) return null;

  const handleReveal = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await caseworkerService.revealPii(caseId);
      setData(res);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          "Authorization Denied: AWS Cedar rejected PII unmasking. Confirm organization scope matches record."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Audited PII Rehydration Desk
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">Target Dossier:</span>
                <span className="font-mono text-xs text-amber-300 font-bold">{caseId}</span>
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
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <strong>Access Denied:</strong> {errorMsg}
              </div>
            </div>
          )}

          {/* Cedar Policy Security Notice */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4" />
              <span>Cedar Policy #3 & Statutory Audit Requirements</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Unmasking personally identifiable information from the Presidio Vault requires
              authenticated <code className="text-amber-300 font-mono">Role::"Caseworker"</code>{" "}
              matching the record's <code className="text-amber-300 font-mono">org_id ({orgId})</code>
              . Each retrieval is permanently stamped in the CloudWatch compliance ledger.
            </p>
          </div>

          {!data ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="font-semibold text-white">Before Proceeding:</div>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Verify that you are preparing an official agency application filing.</li>
                  <li>Do not store unmasked client identities on unencrypted local drives.</li>
                  <li>Ensure client consent has been documented per agency guidelines.</li>
                </ul>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="confirmAudit"
                  checked={confirmedAudit}
                  onChange={(e) => setConfirmedAudit(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor="confirmAudit"
                  className="text-xs text-slate-200 font-medium cursor-pointer select-none"
                >
                  I certify that I am accessing this client PII for official case processing under{" "}
                  <strong className="text-white">{orgId}</strong>.
                </label>
              </div>

              <button
                type="button"
                onClick={handleReveal}
                disabled={!confirmedAudit || isLoading}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Eye className="w-4 h-4" />
                <span>{isLoading ? "Querying Vault & Logging Audit..." : "Unmask Client PII"}</span>
              </button>
            </div>
          ) : (
            /* Unmasked Results View */
            <div className="space-y-4 animate-fade-in">
              {/* Audit Confirmation Badge */}
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Audit Trail Generated & Signed to Compliance Ledger</span>
                </div>
                <span className="font-mono text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">
                  200 OK
                </span>
              </div>

              {/* Identity Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Legal Real Name</span>
                  </div>
                  <div className="text-base font-extrabold text-white">
                    {data.client_name || "N/A"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Vault Key: &lt;PERSON_1&gt;
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Client Contact Phone</span>
                  </div>
                  <div className="text-base font-extrabold text-white">
                    {data.client_phone || "Not Provided"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Vault Key: &lt;PHONE_1&gt;
                  </div>
                </div>
              </div>

              {/* Rehydrated Intake Narrative */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-amber-400" />
                  <span>Rehydrated Case Narrative (Full Text)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                  {data.unmasked_summary}
                </div>
              </div>

              {/* Governance Footprint */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Scoped Agency: {orgId}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Presidio AES-GCM</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
