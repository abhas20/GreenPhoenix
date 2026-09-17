import React from "react";
import { Sparkles, Users, BarChart3, Settings, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface RoleGatewaysProps {
  onNavigate: (view: string) => void;
}

export const RoleGateways: React.FC<RoleGatewaysProps> = ({ onNavigate }) => {
  const { switchPersona } = useAuth();

  const handleGateway = async (view: string, personaKey?: string) => {
    if (personaKey) {
      await switchPersona(personaKey);
    }
    onNavigate(view);
  };

  const gateways = [
    {
      role: "Public Citizen",
      title: "Facing Emergency Crisis?",
      description: "Chat with the confidential AI agent. Explain your situation in your own words, find matching programs, and build your document packet.",
      icon: Sparkles,
      actionText: "Start Crisis Intake",
      view: "navigator",
      personaKey: "applicant",
      accent: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60",
    },
    {
      role: "Caseworker & CBO",
      title: "Case Management Desk",
      description: "Review client dossiers, manage organization-scoped records, perform audited PII rehydration, and export agency submission packets.",
      icon: Users,
      actionText: "Open Caseworker Desk",
      view: "caseworker",
      personaKey: "cw_hra",
      accent: "from-blue-500/20 via-indigo-500/10 to-transparent border-blue-500/30 text-blue-400 hover:border-blue-500/60",
    },
    {
      role: "Policy Analyst",
      title: "Algorithmic Equity Hub",
      description: "Track Disparate Impact Ratios (DIR) against the legal 0.80 four-fifths rule across multilingual and demographic synthetic cohorts. Zero PII.",
      icon: BarChart3,
      actionText: "View Fairness Analytics",
      view: "analyst",
      personaKey: "analyst",
      accent: "from-purple-500/20 via-pink-500/10 to-transparent border-purple-500/30 text-purple-400 hover:border-purple-500/60",
    },
    {
      role: "System Admin",
      title: "Operations & Observability",
      description: "Inspect OpenSearch, Redis, and LLM cluster status, trigger manual synthetic bias replays, and re-seed vector embeddings from CSV.",
      icon: Settings,
      actionText: "Launch Admin Center",
      view: "admin",
      personaKey: "admin",
      accent: "from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30 text-amber-400 hover:border-amber-500/60",
    },
  ];

  return (
    <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
          Role-Gated Portals
        </h2>
        <h3 className="text-3xl font-extrabold text-white tracking-tight">
          Tailored Workspaces for Every Stakeholder
        </h3>
        <p className="mt-3 text-sm text-slate-400">
          Switch roles seamlessly to explore how AWS Cedar authorization governs access
          between public applicants, agency workers, equity researchers, and administrators.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {gateways.map((gw) => {
          const Icon = gw.icon;
          return (
            <div
              key={gw.role}
              className={`p-6 rounded-3xl bg-gradient-to-b border flex flex-col justify-between transition-all hover:scale-[1.02] shadow-xl ${gw.accent}`}
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-[10px] font-mono uppercase font-bold tracking-wider opacity-75">
                  {gw.role}
                </div>
                <h4 className="text-lg font-bold text-white mt-1 mb-2">{gw.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{gw.description}</p>
              </div>

              <button
                type="button"
                onClick={() => handleGateway(gw.view, gw.personaKey)}
                className="mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900/90 text-white border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{gw.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
