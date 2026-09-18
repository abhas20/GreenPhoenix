import React from "react";
import {
  Server,
  Database,
  RefreshCw,
  Cpu,
  Bot,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";
import type { HealthStatus } from "../../types/audit";

interface ClusterHealthGridProps {
  health: HealthStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
  lastChecked: string;
}

export const ClusterHealthGrid: React.FC<ClusterHealthGridProps> = ({
  health,
  isLoading,
  onRefresh,
  lastChecked,
}) => {
  const isServerHealthy = health?.status === "healthy";
  const isOpenSearchHealthy =
    health?.opensearch === "green" || health?.opensearch === "yellow";
  const isRedisConnected = health?.redis === "connected";

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col gap-4">
      {/* Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Live Cluster Observability & Infrastructure Health
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry from FastAPI backend probes, OpenSearch vector search, and Redis session stores.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 font-mono">
            Updated: {new Date(lastChecked).toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Poll cluster status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid of services */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
        {/* 1. FastAPI Core */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white">FastAPI Core Server</span>
            </div>
            <div className="text-[11px] text-slate-400">REST & Auth API Gateway</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Env: {health?.environment || "development"} • Port: 8000
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono flex items-center gap-1 ${
              isServerHealthy
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
            }`}
          >
            {isServerHealthy ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            <span>{isServerHealthy ? "Operational" : "Offline"}</span>
          </span>
        </div>

        {/* 2. OpenSearch Vector Store */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">OpenSearch Hybrid Vector</span>
            </div>
            <div className="text-[11px] text-slate-400">KNN Embeddings + BM25 Lexical</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Cluster Status: {health?.opensearch || "unreachable"}
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono flex items-center gap-1 ${
              isOpenSearchHealthy
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
            }`}
          >
            {isOpenSearchHealthy ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            <span>{isOpenSearchHealthy ? "Connected" : "Degraded"}</span>
          </span>
        </div>

        {/* 3. Redis Session Store */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">Redis Session Store</span>
            </div>
            <div className="text-[11px] text-slate-400">Transient Crisis Cache & TTL</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Connection: {health?.redis || "in-memory fallback"}
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono flex items-center gap-1 ${
              isRedisConnected
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{isRedisConnected ? "Connected" : "In-Memory Active"}</span>
          </span>
        </div>

        {/* 4. Primary LLM Model */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">Primary AI Agent LLM</span>
            </div>
            <div className="text-[11px] text-slate-400">Strands Multi-Agent Intake Engine</div>
            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
              Model: {health?.primary_llm_model || "gemini-2.5-pro"}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Ready</span>
          </span>
        </div>

        {/* 5. Presidio PII Vault */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Presidio De-Identification</span>
            </div>
            <div className="text-[11px] text-slate-400">Pre-LLM Sanitization Pipeline</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Tokens: &lt;PERSON_1&gt;, &lt;PHONE_1&gt;
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Enforced</span>
          </span>
        </div>

        {/* 6. AWS Cedar Policy Engine */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">AWS Cedar Policy Engine</span>
            </div>
            <div className="text-[11px] text-slate-400">Zero-Trust RBAC & Org Scope Gate</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Policies #1 - #5 Active
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Permitted</span>
          </span>
        </div>
      </div>
    </div>
  );
};
