import React from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const CedarBadge: React.FC = () => {
  const { role, user } = useAuth();

  const getBadgeStyle = () => {
    switch (role) {
      case "Caseworker":
        return {
          bg: "bg-blue-500/10 text-blue-300 border-blue-500/30",
          scope: user?.org_id ? `Org: ${user.org_id}` : "Agency Scoped",
        };
      case "Analyst":
        return {
          bg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
          scope: "PII-Forbidden (Cedar P5)",
        };
      case "Admin":
        return {
          bg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          scope: "SuperAdmin Audit Scope",
        };
      case "PublicApplicant":
      default:
        return {
          bg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
          scope: "Session Isolated (Cedar P1)",
        };
    }
  };

  const { bg, scope } = getBadgeStyle();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${bg}`}
      title="AWS Cedar Policy Gate: Fine-grained RBAC & ABAC active"
    >
      <Lock className="w-3 h-3 opacity-70" />
      <span>Cedar Gate:</span>
      <span className="font-semibold">{role}</span>
      <span className="opacity-60 text-[10px]">({scope})</span>
      <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-0.5" />
    </div>
  );
};
