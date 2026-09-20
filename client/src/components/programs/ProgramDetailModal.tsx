import React, { useEffect, useState } from "react";
import {
  X,
  ExternalLink,
  Phone,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Languages,
  ShieldCheck,
  Calculator,
} from "lucide-react";
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

  const getRegionInfo = (reg: string, id: string) => {
    const r = (reg || "").toLowerCase();
    if (r === "india" || id.startsWith("in-")) {
      return {
        flag: "🇮🇳",
        label: "India (National / All States)",
        badgeColor: "bg-orange-500/15 text-orange-300 border-orange-500/30",
      };
    }
    if (r === "nyc" || id.startsWith("nyc-")) {
      return {
        flag: "🇺🇸",
        label: "New York City (5 Boroughs)",
        badgeColor: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      };
    }
    if (r === "uk" || id.startsWith("uk-")) {
      return {
        flag: "🇬🇧",
        label: "United Kingdom (National)",
        badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
      };
    }
    if (r === "canada" || id.startsWith("ca-")) {
      return {
        flag: "🇨🇦",
        label: "Canada (National)",
        badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      };
    }
    return {
      flag: "🌐",
      label: reg ? reg.toUpperCase() : "GLOBAL",
      badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
    };
  };

  const regionInfo = getRegionInfo(program.region, program.program_id);
  const rules = program.eligibility_rules || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                {t(program.category)}
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${regionInfo.badgeColor}`}
              >
                <span>{regionInfo.flag}</span>
                <span>{t(regionInfo.label)}</span>
              </span>
              {program.application_method && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 uppercase">
                  {t(program.application_method.replace("_", " "))}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">{t(program.name)}</h3>
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

          {/* Income & Statutory Rules */}
          {program.income_threshold && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-4 h-4" />
                <span>{t("Statutory Income Threshold & Rules")}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{t(program.income_threshold)}</p>
            </div>
          )}

          {/* Statutory Eligibility Parameters Grid */}
          {(rules.max_annual_income || rules.min_age || rules.requires_disability_benefit || rules.allowed_regions) && (
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-teal-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{t("Statutory Evaluation Criteria")}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {rules.allowed_regions && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t("Jurisdiction")}</span>
                    <span className="text-white font-medium capitalize">
                      {rules.allowed_regions.join(", ")}
                    </span>
                  </div>
                )}
                {rules.min_age && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t("Minimum Age")}</span>
                    <span className="text-white font-medium">{rules.min_age}+ {t("years")}</span>
                  </div>
                )}
                {rules.requires_disability_benefit && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t("Disability Rule")}</span>
                    <span className="text-emerald-400 font-medium">{t("Qualifying Benefit Required")}</span>
                  </div>
                )}
              </div>
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
              <p className="text-xs text-slate-400">{t("Standard identification, local residency, and income documentation.")}</p>
            )}
          </div>

          {/* Languages Supported */}
          {program.languages_supported && program.languages_supported.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Languages className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{t("Languages supported:")}</span>
              <div className="flex flex-wrap gap-1">
                {program.languages_supported.map((lang, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono text-[10px] uppercase"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Application Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            {program.contact_phone && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Official Helpline")}</div>
                  <div className="font-mono text-sm text-slate-100">{program.contact_phone}</div>
                </div>
              </div>
            )}

            {program.application_url && (
              <a
                href={program.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-600 transition-colors group"
              >
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">{t("Official Portal")}</div>
                  <div className="font-semibold text-emerald-400 group-hover:text-emerald-300">{t("Launch Online Application")}</div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
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
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>{t("Test My Eligibility for this Benefit")} &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};
