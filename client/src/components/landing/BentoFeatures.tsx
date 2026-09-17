import React from "react";
import { Cpu, ShieldCheck, Lock, Scale, Globe, ArrowUpRight } from "lucide-react";

export const BentoFeatures: React.FC<{ onExplore: () => void }> = ({ onExplore }) => {
  return (
    <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
          Architecture & Capabilities
        </h2>
        <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Engineered for Trust, Privacy & Civil-Rights Fairness
        </h3>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Unlike generic chatbots that hallucinate aid rules and leak sensitive identities,
          GreenPhoenix enforces mathematical access barriers and deterministic statutory verification.
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Multi-Agent Orchestration (Col-span 2) */}
        <div className="md:col-span-2 relative p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:bg-emerald-500/10 transition-all" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Strands Framework
            </span>
          </div>

          <h4 className="text-xl font-bold text-white mb-2">
            Multi-Agent Conversational Orchestration
          </h4>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Four specialized agents collaborate autonomously. The <strong>Intake Agent</strong> extracts household facts, the <strong>Matching Agent</strong> coordinates OpenSearch dense vector retrieval and hard-bounds verification, the <strong>Document Agent</strong> compiles consolidated verification packs, and the <strong>Audit Agent</strong> verifies fair treatment.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-emerald-400 font-bold">Intake Agent</div>
              <div className="text-slate-400 text-[11px] mt-0.5">Empathetic Extraction</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-teal-400 font-bold">Matching Agent</div>
              <div className="text-slate-400 text-[11px] mt-0.5">Hybrid Vector + Rules</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-cyan-400 font-bold">Document Agent</div>
              <div className="text-slate-400 text-[11px] mt-0.5">Hardship Statements</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-amber-400 font-bold">Audit Agent</div>
              <div className="text-slate-400 text-[11px] mt-0.5">Bias Replay Monitor</div>
            </div>
          </div>
        </div>

        {/* Card 2: Presidio PII Shield */}
        <div className="relative p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group overflow-hidden shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-white mb-2">
            Microsoft Presidio PII Vault
          </h4>
          <p className="text-slate-400 text-xs leading-relaxed mb-4">
            Names, phone numbers, SSNs, and street addresses are stripped before leaving your browser. LLMs and vector indexes only see surrogate tokens like <code className="text-emerald-300">&lt;PERSON_1&gt;</code>.
          </p>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-slate-300">
            <div className="text-rose-400 line-through text-[10px]">Maria, (718) 555-0199</div>
            <div className="text-emerald-400 font-bold">&rarr; &lt;PERSON_1&gt;, &lt;PHONE_1&gt;</div>
          </div>
        </div>

        {/* Card 3: AWS Cedar Policy Gate */}
        <div className="relative p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group overflow-hidden shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-white mb-2">
            AWS Cedar Access Control
          </h4>
          <p className="text-slate-400 text-xs leading-relaxed">
            Every agent action evaluates against formal Cedar policies. Caseworkers are strictly scoped to their organization (<code className="text-blue-300">orgId == principal.orgId</code>), preventing cross-agency case leaks.
          </p>
        </div>

        {/* Card 4: Algorithmic Fairness Watchdog */}
        <div className="relative p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group overflow-hidden shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
            <Scale className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-white mb-2">
            Algorithmic Fairness Watchdog
          </h4>
          <p className="text-slate-400 text-xs leading-relaxed">
            Out-of-band synthetic testing replays identical economic crisis profiles across demographic and language cohorts to enforce the legal <strong>0.80 Disparate Impact Ratio (DIR)</strong>.
          </p>
        </div>

        {/* Card 5: Universal Multilingual Pipeline */}
        <div className="relative p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group overflow-hidden shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
            <Globe className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-white mb-2">
            Indian & Global Languages
          </h4>
          <p className="text-slate-400 text-xs leading-relaxed mb-3">
            Speaks Hindi, Bengali, Tamil, Telugu, Gujarati, Marathi, Punjabi, Urdu, Spanish, Chinese, Russian, and Arabic with automatic grounding in NYC statutory rules.
          </p>
          <button
            type="button"
            onClick={onExplore}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <span>Explore Aid Catalog</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
