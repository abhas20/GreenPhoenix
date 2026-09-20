import React from "react";
import { Sparkles } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

interface SuggestedPromptsProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

const PROMPTS = [
  "I live in Mumbai, earn ₹50,000/yr for family of 4, need Ayushman health & food ration.",
  "Small farmer in Maharashtra with 2 acres cultivable land needing PM-KISAN & rural work.",
  "Single parent in Brooklyn with 2 kids, income $24,000, need food stamps & rent relief.",
  "I receive SSI disability benefits, live in Brooklyn, rent $1,400, need DRIE rent freeze.",
];

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({
  onSelectPrompt,
  disabled,
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span>{t("Suggested questions:")}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(t(p))}
            className="text-left px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 hover:bg-slate-855 text-xs transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {t(p)}
          </button>
        ))}
      </div>
    </div>
  );
};
