import React, { useState } from "react";
import {
  X,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { adminService } from "../../services/adminService";

interface ReseedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReseedModal: React.FC<ReseedModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isReseeding, setIsReseeding] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReseed = async () => {
    setIsReseeding(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      const res = await adminService.reseedIndices();
      setResultMsg(res.message || "OpenSearch catalog successfully re-seeded from CSV dataset.");
      onSuccess();
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          "Failed to re-seed OpenSearch index. Verify OpenSearch cluster is reachable and principal has Cedar Action::'manageIndices'."
      );
    } finally {
      setIsReseeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Re-Seed OpenSearch Catalog Index
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Action::"manageIndices" • Resource::"SearchIndex"
              </p>
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

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-rose-200">
                <strong>Re-Seed Failed:</strong> {errorMsg}
              </div>
            </div>
          )}

          {resultMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Re-Seed Successful:</strong>
                <p className="mt-1 text-[11px] text-emerald-200">{resultMsg}</p>
              </div>
            </div>
          )}

          {!resultMsg && (
            <>
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-slate-300 leading-relaxed text-xs">
                  This operation reads the raw aid programs from{" "}
                  <code className="text-amber-300 font-mono">data/aid_programs_populated.csv</code>,
                  generates 768-dimensional text embeddings, recreates the{" "}
                  <code className="text-amber-300 font-mono">aid-programs</code> KNN index, and
                  rebuilds the hybrid search normalization pipeline.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 space-y-1 text-[11px]">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Target Dataset: Global, National & Regional Benefit Programs (India, US, UK, Canada)</span>
                </div>
                <p>Vector algorithm: HNSW (Hierarchical Navigable Small World) with cosine similarity.</p>
              </div>
            </>
          )}

          {isReseeding && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
              <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-amber-200 font-semibold text-xs">
                Generating vector embeddings and rebuilding OpenSearch index...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {resultMsg ? "Close" : "Cancel"}
          </button>
          {!resultMsg && (
            <button
              type="button"
              onClick={handleReseed}
              disabled={isReseeding}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isReseeding ? "animate-spin" : ""}`} />
              <span>{isReseeding ? "Rebuilding Index..." : "Confirm & Re-Seed"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
