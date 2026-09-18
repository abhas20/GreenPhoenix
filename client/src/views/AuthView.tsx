import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Sparkles,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/auth";

interface AuthViewProps {
  initialMode?: "login" | "register";
}

export const AuthView: React.FC<AuthViewProps> = ({ initialMode = "login" }) => {
  const { login, register, user, role, switchPersona } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<"login" | "register">(initialMode);

  // Read message or redirect from router state
  const stateMessage = (location.state as any)?.message;
  const redirectTarget = (location.state as any)?.from;

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<Role>("Caseworker");
  const [regOrgId, setRegOrgId] = useState<string>("hra_nyc");
  const [customOrg, setCustomOrg] = useState<string>("");

  // Status & error states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const determineDestination = (assignedRole: Role) => {
    if (redirectTarget) return redirectTarget;
    if (assignedRole === "Caseworker") return "/caseworker";
    if (assignedRole === "Analyst") return "/analyst";
    if (assignedRole === "Admin") return "/admin";
    return "/";
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginEmail || !loginPassword) {
      setErrorMsg("Please provide both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      setSuccessMsg("Authentication successful! Redirecting to your authorized workspace...");
      setTimeout(() => {
        // Find persona to get role
        navigate(determineDestination(role));
      }, 600);
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Invalid credentials or account does not exist. Please check and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regName.trim()) {
      setErrorMsg("Full name is required.");
      return;
    }
    if (!regEmail.trim()) {
      setErrorMsg("Valid email is required.");
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    const effectiveOrgId =
      regRole === "Caseworker"
        ? regOrgId === "custom"
          ? customOrg.trim()
          : regOrgId
        : null;

    if (regRole === "Caseworker" && !effectiveOrgId) {
      setErrorMsg("Caseworker registration requires an organization ID (e.g. 'hra_nyc').");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        role: regRole,
        org_id: effectiveOrgId,
      });
      setSuccessMsg(
        `Staff account created for ${regName}! Role: ${regRole}. Redirecting to your workspace...`
      );
      setTimeout(() => {
        navigate(determineDestination(regRole));
      }, 700);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          "Registration failed. Email might already exist or role parameters are invalid."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click Evaluation Login that switches persona AND redirects to the corresponding route!
  const handleInstantDemoLogin = async (personaKey: string, targetRoute: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await switchPersona(personaKey);
      setSuccessMsg(`Authenticated as demo persona! Moving to ${targetRoute}...`);
      setTimeout(() => {
        navigate(targetRoute);
      }, 400);
    } catch (err: any) {
      setErrorMsg("Demo switch failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col justify-center">
      {/* Return button */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Public Home</span>
        </Link>
      </div>

      {/* Unauthorized Access Redirect Alert Banner */}
      {stateMessage && (
        <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 shadow-lg shadow-amber-500/5">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <strong className="text-white block mb-0.5">Authorization Barrier Enforced:</strong>
            {stateMessage}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Security Policy & 1-Click Evaluation Shortcuts */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Staff Identity & Cedar RBAC Gate
                </h2>
                <p className="text-xs text-slate-400">AWS Cedar Zero-Trust Authorization</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              GreenPhoenix enforces strict policy-based boundaries via{" "}
              <strong className="text-emerald-300">AWS Cedar</strong>. Public citizen applicants
              browse anonymously with zero PII retention, while agency caseworkers, policy
              analysts, and system administrators must hold verified credentials.
            </p>

            {/* 1-Click Evaluation Shortcuts that REDIRECT to real routes */}
            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> 1-Click Evaluation Sign-In
                </span>
                <span className="text-[10px] text-slate-400">Instant Redirect</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Click any persona below to authenticate into the backend and jump directly to their
                respective protected URL route:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin("cw_hra", "/caseworker")}
                  disabled={isSubmitting}
                  className="p-3 text-left rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 text-xs text-slate-200 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-300 group-hover:text-blue-200">Sarah Jenkins</span>
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">/caseworker</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">NYC HRA Caseworker (hra_nyc)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin("cw_cbo", "/caseworker")}
                  disabled={isSubmitting}
                  className="p-3 text-left rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-200 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 group-hover:text-cyan-200">Carlos Rivera</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">/caseworker</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Queens CBO Caseworker (queens_cbo)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin("analyst", "/analyst")}
                  disabled={isSubmitting}
                  className="p-3 text-left rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 text-xs text-slate-200 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300 group-hover:text-purple-200">Dr. Maya Patel</span>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">/analyst</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Civil Rights & Policy Analyst</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin("admin", "/admin")}
                  disabled={isSubmitting}
                  className="p-3 text-left rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-xs text-slate-200 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 group-hover:text-amber-200">Dev Ops Admin</span>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">/admin</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">System Administrator</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sign In / Register Form Container */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
            {/* Mode Switch Tabs */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Staff Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Register Staff Identity
              </button>
            </div>

            {/* Currently Active User Status Card */}
            {user && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <span className="text-slate-300">Signed in as: </span>
                    <strong className="text-white">{user.name}</strong>{" "}
                    <span className="text-emerald-400">({user.role})</span>
                    {user.org_id && (
                      <span className="text-slate-400 ml-1">[{user.org_id}]</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(determineDestination(role))}
                  className="px-3.5 py-1.5 text-xs font-bold bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  Go to Workspace
                </button>
              </div>
            )}

            {/* Alert Messages */}
            {errorMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-200">
                  <strong>Authentication Failed:</strong> {errorMsg}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-xs text-emerald-200 font-semibold">{successMsg}</div>
              </div>
            )}

            {/* Forms */}
            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Staff Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="e.g. sjenkins@hra.nyc.gov"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isSubmitting ? "Authenticating..." : "Sign In to Staff Desk"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Full Name & Title
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sarah Jenkins, LMSW"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Official Agency Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="sjenkins@hra.nyc.gov"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password (Min. 8 characters)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="••••••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {/* Role selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Staff Role (Cedar Policy Principal)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Caseworker", "Analyst", "Admin"] as Role[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRegRole(r)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          regRole === r
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Organization ID - strictly mandatory for Caseworker */}
                {regRole === "Caseworker" && (
                  <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                      <Building2 className="w-4 h-4" />
                      <span>Organization Scope (Mandatory for Caseworkers)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Under Cedar Policy #2, Caseworkers can only view and process cases belonging
                      to their assigned organization.
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRegOrgId("hra_nyc")}
                        className={`p-2 rounded-xl text-xs font-semibold border text-left cursor-pointer transition-all ${
                          regOrgId === "hra_nyc"
                            ? "bg-blue-500/20 border-blue-500 text-blue-200"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        <div className="font-bold">hra_nyc</div>
                        <div className="text-[10px] text-slate-400">NYC HRA Agency</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegOrgId("queens_cbo")}
                        className={`p-2 rounded-xl text-xs font-semibold border text-left cursor-pointer transition-all ${
                          regOrgId === "queens_cbo"
                            ? "bg-cyan-500/20 border-cyan-500 text-cyan-200"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        <div className="font-bold">queens_cbo</div>
                        <div className="text-[10px] text-slate-400">Queens Non-Profit</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegOrgId("custom")}
                        className={`p-2 rounded-xl text-xs font-semibold border text-left cursor-pointer transition-all ${
                          regOrgId === "custom"
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-200"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        <div className="font-bold">Custom Org</div>
                        <div className="text-[10px] text-slate-400">Specify ID</div>
                      </button>
                    </div>

                    {regOrgId === "custom" && (
                      <input
                        type="text"
                        placeholder="Enter organization slug (e.g. bronx_aid_net)"
                        value={customOrg}
                        onChange={(e) => setCustomOrg(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isSubmitting ? "Registering Identity..." : "Create Staff Account"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
