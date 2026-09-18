import React, { useState, useEffect } from "react";
import {
  X,
  FileDown,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  AlertCircle,
  FileText,
} from "lucide-react";
import { caseworkerService } from "../../services/caseworkerService";
import type { ExportCaseResponse } from "../../types/caseworker";

interface ExportPacketModalProps {
  caseId: string | null;
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
}

export const ExportPacketModal: React.FC<ExportPacketModalProps> = ({
  caseId,
  isOpen,
  onClose,
  orgId,
}) => {
  const [packet, setPacket] = useState<ExportCaseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && caseId) {
      setIsLoading(true);
      setErrorMsg(null);
      setCopied(false);
      caseworkerService
        .exportCase(caseId)
        .then((res) => setPacket(res))
        .catch((err) =>
          setErrorMsg(
            err?.message ||
              "Failed to export application packet. Cedar policy requires exportApplication privileges."
          )
        )
        .finally(() => setIsLoading(false));
    } else {
      setPacket(null);
    }
  }, [isOpen, caseId]);

  if (!isOpen || !caseId) return null;

  const handleCopyJson = () => {
    if (!packet) return;
    navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!packet) return;
    const blob = new Blob([JSON.stringify(packet, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GreenPhoenix_CasePacket_${caseId}_${orgId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const caseData = packet?.case_data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Consolidated Agency Application Packet
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">Target Case:</span>
                <span className="font-mono text-xs text-purple-300 font-bold">{caseId}</span>
                <span className="text-xs text-slate-400 ml-2">Scope:</span>
                <span className="font-mono text-xs text-blue-300 font-bold">{orgId}</span>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scroll">
          {isLoading && (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
              Consolidating case dossier and validating statutory export signatures...
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <strong>Export Authorization Error:</strong> {errorMsg}
              </div>
            </div>
          )}

          {packet && caseData && (
            <div className="space-y-4 animate-fade-in">
              {/* Compliance banner */}
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-purple-300">
                  <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    Authorized under AWS Cedar Policy:{" "}
                    <code className="font-mono text-[11px] bg-purple-500/20 px-1.5 py-0.5 rounded">
                      exportApplication
                    </code>
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(packet.exported_at).toLocaleTimeString()}
                </span>
              </div>

              {/* Formatted Filing Summary */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Statutory Filing Submission Metadata</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-850">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">
                      Client Real Identity
                    </span>
                    <span className="text-white font-bold text-sm">
                      {caseData.client_name_real || caseData.client_name_masked}
                    </span>
                    {caseData.client_phone && (
                      <div className="text-slate-400 text-xs mt-0.5">
                        Phone: {caseData.client_phone}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-850">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">
                      Filing Agency & Creator
                    </span>
                    <span className="text-blue-300 font-bold">{caseData.org_id}</span>
                    <div className="text-slate-400 text-xs mt-0.5">
                      Officer ID: {caseData.created_by}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-850">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">
                      Financial Profile
                    </span>
                    <div className="text-white font-semibold">
                      Income: ${caseData.profile?.annual_income?.toLocaleString() || 0} / yr
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      Rent: ${caseData.profile?.monthly_rent?.toLocaleString() || 0} / mo
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-850">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">
                      Jurisdiction & Needs
                    </span>
                    <div className="text-white font-semibold">
                      Borough: {caseData.profile?.borough || "NYC"}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5 truncate">
                      Needs: {caseData.profile?.primary_needs?.join(", ") || "General"}
                    </div>
                  </div>
                </div>

                {/* Case narrative */}
                <div className="pt-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                    Certified Case Summary
                  </span>
                  <p className="p-3 rounded-xl bg-slate-900 border border-slate-850 text-xs text-slate-300 leading-relaxed">
                    {caseData.sanitized_summary || caseData.profile?.summary}
                  </p>
                </div>
              </div>

              {/* Raw JSON Payload Inspector */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Raw Encrypted Agency Document Payload
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-850 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto custom-scroll">
                  {JSON.stringify(packet, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Official NYC HRA / HPD Data Packet</span>
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!packet}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>Download Filing Packet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
