import React from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

interface ProgramTickerProps {
  onSelectProgram: (programId: string) => void;
}

const TOP_PROGRAMS = [
  {
    id: "nyc-snap-001",
    name: "NYC SNAP (Food Stamps)",
    badge: "Food & Nutrition",
    highlight: "Up to $973/mo for households",
    color: "from-emerald-500/20 to-teal-500/10 text-emerald-300 border-emerald-500/30",
  },
  {
    id: "nyc-scrie-001",
    name: "SCRIE Senior Rent Freeze",
    badge: "Housing / Seniors 62+",
    highlight: "Freezes rent permanently against increases",
    color: "from-blue-500/20 to-indigo-500/10 text-blue-300 border-blue-500/30",
  },
  {
    id: "nyc-drie-001",
    name: "DRIE Disability Rent Freeze",
    badge: "Disability / Rent Relief",
    highlight: "Rent freeze for SSI/SSDI/VA recipients",
    color: "from-purple-500/20 to-pink-500/10 text-purple-300 border-purple-500/30",
  },
  {
    id: "nyc-one-shot-001",
    name: "One-Shot Deal (HRA)",
    badge: "Emergency Eviction Grant",
    highlight: "Emergency grant preventing eviction & utility shutoff",
    color: "from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/30",
  },
  {
    id: "nyc-cash-assist-001",
    name: "Cash Assistance (CA)",
    badge: "Financial Relief",
    highlight: "Bi-weekly cash support for essential living costs",
    color: "from-teal-500/20 to-cyan-500/10 text-teal-300 border-teal-500/30",
  },
  {
    id: "nyc-heap-001",
    name: "HEAP Heating & Energy Relief",
    badge: "Utilities",
    highlight: "Direct utility bill relief grants up to $1,000",
    color: "from-rose-500/20 to-orange-500/10 text-rose-300 border-rose-500/30",
  },
];

export const ProgramTicker: React.FC<ProgramTickerProps> = ({ onSelectProgram }) => {
  const { t } = useLanguage();

  return (
    <section className="py-12 border-y border-slate-800/80 bg-slate-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              {t("Available Aid Programs")}
            </span>
            <h3 className="text-2xl font-bold text-white mt-1">
              {t("Top NYC Public Safety Net Benefits")}
            </h3>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{t("Statutory rules updated from official NYC Open Data")}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOP_PROGRAMS.map((prog) => (
            <div
              key={prog.id}
              onClick={() => onSelectProgram(prog.id)}
              className={`p-5 rounded-2xl bg-gradient-to-br border transition-all hover:scale-[1.01] hover:shadow-lg cursor-pointer ${prog.color}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-900/60 border border-current">
                  {t(prog.badge)}
                </span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">{t(prog.name)}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{t(prog.highlight)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
