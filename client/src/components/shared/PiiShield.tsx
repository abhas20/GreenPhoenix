import React, { useState } from "react";
import { Shield, ShieldCheck, Info } from "lucide-react";

export const PiiShield: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer"
        title="Presidio PII Shield Active"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        {!compact && <span>Presidio PII Shield Active</span>}
        <Info className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {showTooltip && (
        <div className="absolute top-full left-0 mt-2 w-72 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 text-xs text-slate-300 backdrop-blur-md">
          <div className="flex items-center gap-2 font-semibold text-emerald-400 mb-1.5">
            <Shield className="w-4 h-4" />
            <span>Zero-PII Privacy Protection</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            Microsoft Presidio automatically detects names, phone numbers, SSNs, and street addresses,
            converting them into safe surrogate tokens (e.g. <code className="text-emerald-300 bg-slate-800 px-1 py-0.5 rounded">&lt;PERSON_1&gt;</code>)
            before AI analysis. Real data is securely vaulted at the session edge.
          </p>
        </div>
      )}
    </div>
  );
};
