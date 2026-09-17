import React from "react";
import { CheckCircle2, AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import type { ProgramMatch } from "../../types/program";

export const ProgramMatchCard: React.FC<{ match: ProgramMatch }> = ({ match }) => {
  const confidencePercent = Math.round(match.match_confidence * 100);

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-md transition-all space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
              {match.category}
            </span>
            {match.is_deterministically_eligible && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" /> Statutory Rules Verified
              </span>
            )}
          </div>
          <h4 className="text-base font-bold text-white mt-1">{match.name}</h4>
          <p className="text-xs text-slate-400">{match.organization}</p>
        </div>

        {/* Match Confidence Gauge */}
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              {confidencePercent}%
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Match Score
          </span>
        </div>
      </div>

      {/* Why You Qualify Explanation */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-200 leading-relaxed">
        <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1">
          Why You Qualify
        </div>
        <p>{match.plain_language_reason}</p>
      </div>

      {/* Passed Criteria */}
      {match.passed_criteria && match.passed_criteria.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-slate-400">Verified Criteria:</div>
          <div className="flex flex-wrap gap-1.5">
            {match.passed_criteria.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{c}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Potential Blockers */}
      {match.potential_blockers && match.potential_blockers.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-amber-400">Potential Blockers:</div>
          <div className="flex flex-wrap gap-1.5">
            {match.potential_blockers.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/20"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{b}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action CTA */}
      <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
        <span className="text-[11px] text-slate-400">
          Method: <strong className="text-slate-300 capitalize">{match.application_method}</strong>
        </span>
        {match.application_url && (
          <a
            href={match.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-sm shadow-emerald-500/20"
          >
            <span>Apply Now</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};
