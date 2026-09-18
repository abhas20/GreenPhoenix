import React from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Lock, ShieldAlert, ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { Role } from "../../types/auth";

interface ProtectedRouteProps {
  allowedRoles: Role[];
  viewName: string;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  viewName,
  children,
}) => {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  // Show small spinner while checking existing JWT session
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-slate-400 text-xs">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mb-3" />
        <span>Validating AWS Cedar authorization token...</span>
      </div>
    );
  }

  // 1. Unauthenticated or Public Citizen -> Redirect immediately to /login with state message
  if (!user || role === "PublicApplicant") {
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname,
          message: `Authentication Required: The ${viewName} is a restricted staff workspace governed by AWS Cedar. Please sign in with an authorized agency account.`,
        }}
        replace
      />
    );
  }

  // 2. Authenticated, but lacking sufficient role privilege (e.g. Caseworker attempting to view /admin)
  if (!allowedRoles.includes(role)) {
    const userWorkspaceRoute =
      role === "Caseworker"
        ? "/caseworker"
        : role === "Analyst"
        ? "/analyst"
        : role === "Admin"
        ? "/admin"
        : "/";

    return (
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center justify-center">
        <div className="w-full p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-5 shadow-lg shadow-rose-500/10">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>403 Forbidden • Cedar RBAC Barrier</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Insufficient Role Privileges
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mt-2.5 max-w-md mx-auto leading-relaxed">
            You are authenticated as <strong className="text-white">{user.name}</strong> with role claim{" "}
            <code className="text-rose-300 font-mono font-semibold">Role::"{role}"</code>. Access to the{" "}
            <span className="text-white font-bold">{viewName}</span> strictly requires{" "}
            <span className="text-emerald-300 font-mono font-bold">
              {allowedRoles.map((r) => `Role::"${r}"`).join(" or ")}
            </span>.
          </p>

          {/* User identity & org details */}
          <div className="my-6 p-4 rounded-2xl bg-slate-950 border border-slate-850 max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span>Account Email:</span>
              <span className="font-semibold text-slate-200">{user.email}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Active Role:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">
                {role}
              </span>
            </div>
            {user.org_id && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Assigned Agency:</span>
                <span className="text-blue-300 font-mono flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {user.org_id}
                </span>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={userWorkspaceRoute}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Go to My Authorized Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized -> Render protected sensitive view
  return <>{children}</>;
};
