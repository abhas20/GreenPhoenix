import React, { useState } from "react";
import { Copy, Check, Printer, FileText } from "lucide-react";
import type { ApplicationDraft } from "../../types/program";
import { useLanguage } from "../../context/LanguageContext";

export const HardshipDraft: React.FC<{ draft: ApplicationDraft | null }> = ({ draft }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!draft || !draft.sample_hardship_statement) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
        {t("No application pack generated yet. Once you provide your basic situation in the chat, the Document Agent will draft a personalized hardship letter and next steps.")}
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(draft.sample_hardship_statement);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Hardship Statement Box */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <FileText className="w-4 h-4" />
            <span>{t("Personal Hardship Statement Draft")}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t("Copied!")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t("Copy Text")}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("Print Packet")}</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
          {draft.sample_hardship_statement}
        </div>
      </div>

      {/* Next Steps Roadmap */}
      {draft.next_steps && draft.next_steps.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {t("Recommended Next Submission Steps")}
          </h5>
          <ol className="space-y-2">
            {draft.next_steps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{t(step)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Excluded Programs Notice (if any) */}
      {draft.excluded_programs && draft.excluded_programs.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
          <div className="font-bold">{t("Excluded Programs Note:")}</div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
            {draft.excluded_programs.map((ex, i) => (
              <li key={i}>
                <strong>{ex.program_id}:</strong> {t(ex.reason)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
