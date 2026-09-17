import React, { useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { Navbar } from "./components/shared/Navbar";
import { HomeView } from "./views/HomeView";
import { ProgramCatalogView } from "./views/ProgramCatalogView";
import { NavigatorView } from "./views/NavigatorView";

const MainContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>("home");
  const [selectedProgramId, setSelectedProgramId] = useState<string | undefined>(undefined);
  const { currentLanguage, isTranslationActive } = useLanguage();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100 w-full max-w-full overflow-x-hidden">
      <Navbar currentView={currentView} onNavigate={setCurrentView} />

      {/* Language translation active alert bar if user selected non-English */}
      {isTranslationActive && (
        <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-transparent border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>
              <strong>Active Language:</strong> {currentLanguage.nativeName} ({currentLanguage.name}) —
              All crisis conversations will be auto-translated to English for statutory NYC aid verification and responded back in {currentLanguage.nativeName}.
            </span>
          </div>
        </div>
      )}

      {/* Main View Display Container */}
      <main className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden min-h-0">
        {currentView === "home" && (
          <HomeView
            onNavigate={setCurrentView}
            onSelectProgram={(progId) => {
              setSelectedProgramId(progId);
              setCurrentView("programs");
            }}
          />
        )}

        {currentView === "programs" && (
          <ProgramCatalogView initialProgramId={selectedProgramId} />
        )}

        {currentView === "navigator" && <NavigatorView />}

        {currentView === "caseworker" && (
          <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-16 text-center text-slate-400">
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 max-w-md mx-auto">
              <div className="text-blue-400 font-bold mb-2">Step 4 View Coming Up</div>
              <h3 className="text-lg font-bold text-white mb-2">Caseworker Management Portal</h3>
              <p className="text-xs text-slate-400">
                Org-scoped dossier table, new client intake with live Presidio redaction, and audited PII reveal.
              </p>
            </div>
          </div>
        )}

        {currentView === "analyst" && (
          <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-16 text-center text-slate-400">
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 max-w-md mx-auto">
              <div className="text-purple-400 font-bold mb-2">Step 5 View Coming Up</div>
              <h3 className="text-lg font-bold text-white mb-2">Policy Analyst Fairness Dashboard</h3>
              <p className="text-xs text-slate-400">
                Disparate Impact Ratio (DIR) gauges, language parity charts, and zero-PII synthetic audit reports.
              </p>
            </div>
          </div>
        )}

        {currentView === "admin" && (
          <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-16 text-center text-slate-400">
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 max-w-md mx-auto">
              <div className="text-amber-400 font-bold mb-2">Step 5 View Coming Up</div>
              <h3 className="text-lg font-bold text-white mb-2">System Admin Operations Center</h3>
              <p className="text-xs text-slate-400">
                Cluster health probes, on-demand synthetic bias audit runner, and vector index re-seeding.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GreenPhoenix Aid Navigator • Multi-Agent System</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Presidio PII Vault</span>
            <span>AWS Cedar Authorization Gate</span>
            <span>OpenSearch Hybrid Vector</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
