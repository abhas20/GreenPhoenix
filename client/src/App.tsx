import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { Navbar } from "./components/shared/Navbar";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";

import { HomeView } from "./views/HomeView";
import { ProgramCatalogView } from "./views/ProgramCatalogView";
import { NavigatorView } from "./views/NavigatorView";
import { AuthView } from "./views/AuthView";
import { CaseworkerView } from "./views/CaseworkerView";
import { AnalystView } from "./views/AnalystView";
import { AdminView } from "./views/AdminView";

/**
 * Route guard that restricts Crisis Intake exclusively to Public Applicants.
 * Authenticated staff (Caseworker, Analyst, Admin) are redirected to their operational portals.
 */
const CrisisRoute: React.FC = () => {
  const { user, role } = useAuth();
  if (user && role !== "PublicApplicant") {
    if (role === "Caseworker") return <Navigate to="/caseworker" replace />;
    if (role === "Analyst") return <Navigate to="/analyst" replace />;
    if (role === "Admin") return <Navigate to="/admin" replace />;
  }
  return <NavigatorView />;
};

/**
 * Route guard that restricts Aid Program search to roles authorized with
 * `searchPrograms` under Cedar policies (PublicApplicant and Caseworker).
 * Analysts and Admins are redirected to their authorized operational portals.
 */
const ProgramCatalogRoute: React.FC = () => {
  const { user, role } = useAuth();
  if (user && role !== "PublicApplicant" && role !== "Caseworker") {
    if (role === "Analyst") return <Navigate to="/analyst" replace />;
    if (role === "Admin") return <Navigate to="/admin" replace />;
  }
  return <ProgramCatalogView />;
};

const MainLayout: React.FC = () => {
  const { currentLanguage, isTranslationActive } = useLanguage();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100 w-full max-w-full overflow-x-hidden">
      <Navbar />

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

      {/* Main View Router Container */}
      <main className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden min-h-0">
        <Routes>
          {/* Public Citizen Routes */}
          <Route path="/" element={<HomeView />} />
          <Route path="/crisis" element={<CrisisRoute />} />
          <Route path="/programs" element={<ProgramCatalogRoute />} />

          {/* Dedicated Staff Authentication Routes */}
          <Route path="/login" element={<AuthView initialMode="login" />} />
          <Route path="/register" element={<AuthView initialMode="register" />} />

          {/* Sensitive Protected Staff Routes */}
          <Route
            path="/caseworker"
            element={
              <ProtectedRoute
                allowedRoles={["Caseworker", "Admin"]}
                viewName="Caseworker Desk"
              >
                <CaseworkerView />
              </ProtectedRoute>
            }
          />

          <Route
            path="/analyst"
            element={
              <ProtectedRoute
                allowedRoles={["Analyst", "Admin"]}
                viewName="Policy Analyst Fairness Hub"
              >
                <AnalystView />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute
                allowedRoles={["Admin"]}
                viewName="System Admin Operations Center"
              >
                <AdminView />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
