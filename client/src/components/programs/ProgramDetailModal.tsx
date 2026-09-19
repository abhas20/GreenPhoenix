import React, { useEffect, useState } from "react";
import { X, ExternalLink, Phone, FileCheck, CheckCircle2, AlertCircle } from "lucide-react";
import type { ProgramDocument } from "../../types/program";
import { programService } from "../../services/programService";
import { useLanguage } from "../../context/LanguageContext";

interface ProgramDetailModalProps {
  program: ProgramDocument | null;
  onClose: () => void;
  onOpenTester: () => void;
}

export const ProgramDetailModal: React.FC<ProgramDetailModalProps> = ({
  program,
  onClose,
  onOpenTester,
}) => {
  const { t } = useLanguage();
  const [reqs, setReqs] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (program) {
      programService
        .getRequirements(program.program_id)
        .then((res) => setReqs(res))
        .catch(() => setReqs(null));
    }
  }, [program]);

  if (!program) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
              {t(program.category)}
            </span>
            <h3 className="text-xl font-bold text-white mt-1.5">{t(program.name)}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t(program.organization)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {t("Program Overview")}
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">{t(program.description)}</p>
          </div>

          {/* Income & Rules */}
          {program.income_threshold && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-4 h-4" />
                <span>{t("Statutory Income Threshold")}</span>
              </div>
              <p className="text-xs text-slate-300">{t(program.income_threshold)}</p>
            </div>
          )}

          {/* Required Verification Documents */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>{t("Required Verification Documents")}</span>
            </h4>
            {reqs?.required_documents || program.required_documents ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(reqs?.required_documents || program.required_documents || []).map(
                  (doc: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t(doc)}</span>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">{t("Standard NYC identification and residency proof.")}</p>
            )}
          </div>

          {/* Application Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            {program.contact_phone && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Hotline Phone")}</div>
                  <div className="font-mono text-sm text-slate-100">{program.contact_phone}</div>
                </div>
              </div>
            )}

            {program.application_url && (
              <a
                href={program.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-600 transition-colors"
              >
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Official Portal")}</div>
                  <div className="font-semibold text-emerald-400">{t("Launch Online Application")}</div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {t("Close")}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTester();
            }}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
          >
            {t("Test My Eligibility for this Benefit")} &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
