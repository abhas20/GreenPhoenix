import React, { useState } from "react";
import { CheckSquare, Square, Lightbulb, FileCheck2 } from "lucide-react";
import type { DocumentItem } from "../../types/program";
import { useLanguage } from "../../context/LanguageContext";

export const DocumentChecklist: React.FC<{ items: DocumentItem[] }> = ({ items }) => {
  const { t } = useLanguage();
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});

  const toggleCheck = (docName: string) => {
    setCheckedMap((prev) => ({
      ...prev,
      [docName]: !prev[docName],
    }));
  };

  const completedCount = items.filter((item) => checkedMap[item.document_name]).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
        {t("No verification checklist compiled yet. As you chat, the Document Agent will compile required documents.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span>{t("Document Readiness Progress")}</span>
          </span>
          <span className="font-mono text-emerald-400 font-bold">
            {completedCount} {t("of")} {items.length} {t("Ready")} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2.5">
        {items.map((doc, idx) => {
          const isChecked = Boolean(checkedMap[doc.document_name]);
          return (
            <div
              key={idx}
              onClick={() => toggleCheck(doc.document_name)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                isChecked
                  ? "bg-emerald-500/10 border-emerald-500/30 text-slate-200"
                  : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="mt-0.5 text-emerald-400 hover:text-emerald-300 shrink-0"
                >
                  {isChecked ? (
                    <CheckSquare className="w-5 h-5 fill-emerald-500/20" />
                  ) : (
                    <Square className="w-5 h-5 opacity-60" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-sm font-bold ${
                        isChecked ? "line-through text-slate-400" : "text-white"
                      }`}
                    >
                      {t(doc.document_name)}
                    </h5>
                    {doc.required_for_programs && doc.required_for_programs.length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        {doc.required_for_programs.join(", ")}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {t(doc.description)}
                  </p>

                  {doc.tips_for_applicant && (
                    <div className="mt-2.5 flex items-start gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-amber-200">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-normal">{t(doc.tips_for_applicant)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
