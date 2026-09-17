import React from "react";
import { Sparkles, ArrowRight, ShieldCheck, Lock, HeartHandshake, FileText } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

interface HeroSectionProps {
  onStartCrisisFlow: () => void;
  onExplorePrograms: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onStartCrisisFlow,
  onExplorePrograms,
}) => {
  const { currentLanguage, isTranslationActive } = useLanguage();

  return (
    <div className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-28">
      {/* Ambient background glows (MagicUI / Aceternity styling) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-500/20 via-teal-500/15 to-transparent blur-[120px] pointer-events-none -z-10 rounded-full" />
      <div className="absolute top-10 right-10 w-72 h-72 bg-blue-500/10 blur-[100px] pointer-events-none -z-10 rounded-full" />

      <div className="max-w-5xl mx-auto px-4 text-center">
        {/* Top Pill / Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 mb-6 shadow-sm shadow-emerald-500/10 animate-fade-in">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Next-Gen Multi-Agent Aid Navigation</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Presidio Vault & Cedar Gate Active</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
          Find the Emergency Aid You Deserve,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Guaranteed Private & Fair.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
          Behind on rent, facing eviction, or struggling with groceries? Talk to our empathetic, multilingual crisis agent. We match you to official NYC and State benefits using deterministic eligibility checks—with <strong>zero data selling</strong> and <strong>complete PII encryption</strong>.
        </p>

        {isTranslationActive && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs bg-amber-500/15 border border-amber-500/30 text-amber-200">
            <span>🌐 Mother-tongue support active:</span>
            <strong>{currentLanguage.nativeName} ({currentLanguage.name})</strong>
            <span>• Chat freely in your language</span>
          </div>
        )}

        {/* Highlighted Crisis CTA Button (Pulsing, high-contrast) */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={onStartCrisisFlow}
            className="group relative w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Sparkles className="w-5 h-5 text-slate-950 animate-bounce" />
            <span className="relative z-10 tracking-wide font-extrabold">
              Speak to Aid Navigator — Get Help Now
            </span>
            <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform relative z-10" />
          </button>

          <button
            type="button"
            onClick={onExplorePrograms}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl font-semibold text-sm bg-slate-900/90 text-slate-200 border border-slate-700 hover:border-slate-500 hover:bg-slate-850 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Browse 50+ Aid Programs</span>
          </button>
        </div>

        {/* Trust Badges */}
        <div className="mt-10 pt-8 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-400">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Microsoft Presidio PII Shield</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-teal-400 shrink-0" />
            <span>AWS Cedar Fine-Grained Gate</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <HeartHandshake className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Zero Hallucinated Eligibility</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Indian & Global Languages</span>
          </div>
        </div>
      </div>
    </div>
  );
};
