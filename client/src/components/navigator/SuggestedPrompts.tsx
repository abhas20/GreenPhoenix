import React from "react";
import { Sparkles } from "lucide-react";

interface SuggestedPromptsProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

const PROMPTS = [
  "I live in Brooklyn and fell behind on rent. Can I get emergency help?",
  "Single parent in Queens with 2 kids, need SNAP food and cash assistance.",
  "I am 65 living in Manhattan and my landlord is raising my rent.",
  "I receive SSI disability benefits and need help with electric bills.",
];

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({
  onSelectPrompt,
  disabled,
}) => {
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span>Suggested questions:</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(p)}
            className="text-left px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 hover:bg-slate-850 text-xs transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};
