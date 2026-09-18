import React, { useState } from "react";
import {
  X,
  Play,
  Scale,
  CheckCircle2,
  AlertCircle,
  Layers,
  Bot,
} from "lucide-react";
import { auditService } from "../../services/auditService";
import type { BiasAuditReport, TriggerAuditRequest } from "../../types/audit";

interface AuditRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuditCompleted: (report: BiasAuditReport) => void;
}

export const AuditRunnerModal: React.FC<AuditRunnerModalProps> = ({
  isOpen,
  onClose,
  onAuditCompleted,
}) => {
  const [batchSize, setBatchSize] = useState<number>(8);
  const [mode, setMode] = useState<"deterministic" | "agentic">("deterministic");
  const [auditIntake, setAuditIntake] = useState<boolean>(false);

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BiasAuditReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setErrorMsg(null);
    setResult(null);

    const req: TriggerAuditRequest = {
      batch_size: batchSize,
      mode,
      audit_intake: auditIntake,
    };

    try {
      const res = await auditService.triggerAudit(req);
      setResult(res);
      onAuditCompleted(res);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          "Failed to trigger audit replay. Ensure you have Cedar Role::'Admin' authorization."
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Trigger On-Demand Synthetic Bias Audit
              </h3>
              <p className="text-xs text-slate-400">
                Authorized under AWS Cedar Action::"runAuditManually"
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scroll">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <strong>Audit Replay Error:</strong> {errorMsg}
              </div>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleRunAudit} className="space-y-5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Execute a synthetic demographic replay to test benefit match consistency across
                different languages and boroughs. The newly generated report will be indexed into
                OpenSearch and made available on the Policy Analyst dashboard.
              </p>

              {/* Batch size selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Sample Batch Size (Synthetic Cohorts)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[4, 8, 12, 16].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setBatchSize(size)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        batchSize === size
                          ? "bg-purple-500/20 text-purple-300 border-purple-500 shadow-sm"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {size} Scenarios
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Execution Matching Engine
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("deterministic")}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      mode === "deterministic"
                        ? "bg-purple-500/15 border-purple-500/50 text-purple-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>Deterministic Rule Engine</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Fast eligibility verification comparing exact income, borough, and disability criteria.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("agentic")}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      mode === "agentic"
                        ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span>Strands Agentic Loop</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Full multi-agent reasoning loop evaluating hybrid OpenSearch retrieval and reasoning.
                    </p>
                  </button>
                </div>
              </div>

              {/* Intake re-extraction checkbox */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <input
                  type="checkbox"
                  id="auditIntake"
                  checked={auditIntake}
                  onChange={(e) => setAuditIntake(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-purple-500 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="auditIntake" className="text-xs text-slate-300 cursor-pointer select-none">
                  <strong>Test Multi-Lingual Intake Translation Pipeline:</strong> Re-extract
                  demographic facts through IntakeAgent to evaluate translation fidelity.
                </label>
              </div>

              {isRunning && (
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full shrink-0" />
                  <div className="text-xs text-purple-200">
                    <strong>Executing synthetic bias audit:</strong> Replaying {batchSize} scenarios
                    across multilingual cohorts and validating DIR thresholds...
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isRunning}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isRunning ? "Running Audit Suite..." : "Launch Synthetic Bias Replay"}</span>
              </button>
            </form>
          ) : (
            /* Results View */
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Audit Completed & Indexed to OpenSearch</span>
                </div>
                <span className="font-mono text-[11px] bg-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Run ID: {result.run_id}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Disparate Impact Ratio
                  </span>
                  <span className="text-xl font-extrabold text-white">
                    {result.disparate_impact_ratio.toFixed(2)}
                  </span>
                  <div className="text-[10px] text-emerald-400 mt-0.5">≥ 0.80 Four-Fifths Goal</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Evaluated Languages
                  </span>
                  <span className="text-xl font-extrabold text-purple-300">
                    {result.languages_evaluated.length}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">Indian + Global Cohorts</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Fairness Verdict
                  </span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {result.fairness_status}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {result.total_replays} total test runs
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Disparity Summary
                </span>
                <p className="text-slate-300 leading-relaxed">{result.disparity_summary}</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-white transition-colors cursor-pointer"
                >
                  Run Another Test
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
