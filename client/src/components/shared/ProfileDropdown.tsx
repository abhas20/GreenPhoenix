import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  ChevronDown,
  Building2,
  Lock,
  Globe,
  Check,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage, SUPPORTED_LANGUAGES } from "../../context/LanguageContext";

export const ProfileDropdown: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { currentLanguage, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowLangPicker(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowLangPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!user) return null;

  // Extract initials (e.g. "Evelyn Reed" -> "ER")
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(user.name);

  // Role color palette
  const roleStyles = {
    Admin: {
      border: "border-amber-500/50 hover:border-amber-400",
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      avatarBg: "bg-gradient-to-tr from-amber-600 to-orange-500",
      label: "System Administrator",
    },
    Caseworker: {
      border: "border-blue-500/50 hover:border-blue-400",
      badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      avatarBg: "bg-gradient-to-tr from-blue-600 to-cyan-500",
      label: `Caseworker (${user.org_id || "Agency"})`,
    },
    Analyst: {
      border: "border-purple-500/50 hover:border-purple-400",
      badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      avatarBg: "bg-gradient-to-tr from-purple-600 to-pink-500",
      label: "Policy Analyst",
    },
    PublicApplicant: {
      border: "border-emerald-500/50 hover:border-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      avatarBg: "bg-gradient-to-tr from-emerald-600 to-teal-500",
      label: "Public Applicant",
    },
  }[role] || {
    border: "border-slate-700 hover:border-slate-500",
    badge: "bg-slate-800 text-slate-300 border-slate-700",
    avatarBg: "bg-slate-700",
    label: role,
  };

  const handleSignOut = () => {
    logout();
    setIsOpen(false);
    navigate("/");
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Profile Avatar Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowLangPicker(false);
        }}
        className={`flex items-center gap-2 p-1 sm:pl-1.5 sm:pr-2.5 rounded-full bg-slate-900 border transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 ${roleStyles.border}`}
        title={`${user.name} (${role})`}
        aria-expanded={isOpen}
      >
        <div className="relative">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${roleStyles.avatarBg} text-white font-bold text-xs flex items-center justify-center shadow-inner`}
          >
            {initials}
          </div>
          {/* Active status indicator dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
        </div>

        <div className="hidden md:flex flex-col items-start text-left leading-tight mr-1">
          <span className="text-xs font-bold text-slate-100 max-w-[110px] truncate">
            {user.name}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {role === "Admin"
              ? "Admin"
              : role === "Caseworker"
              ? user.org_id || "Caseworker"
              : "Analyst"}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-white" : ""
          }`}
        />
      </button>

      {/* Profile Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-76 sm:w-80 rounded-2xl bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 shadow-2xl z-50 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
          {/* User Details Header */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-full ${roleStyles.avatarBg} text-white font-extrabold text-sm flex items-center justify-center shadow-lg shrink-0`}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-white text-sm truncate">{user.name}</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">{user.email || `@${user.id}`}</div>
              <div className="pt-0.5">
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleStyles.badge}`}
                >
                  {roleStyles.label}
                </span>
              </div>
            </div>
          </div>

          {/* Caseworker Org Scope Notice */}
          {user.org_id && (
            <div className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0 text-blue-400" />
              <div className="text-[11px] leading-tight">
                <span>{t("Tenant Agency:")} </span>
                <strong className="font-mono text-white">{user.org_id}</strong>
              </div>
            </div>
          )}

          {/* Quick Staff Navigation Links */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              {t("Authorized Portals")}
            </div>
            {(role === "Caseworker" || role === "Admin") && (
              <Link
                to="/caseworker"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-medium">{t("Caseworker Desk")}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">/caseworker</span>
              </Link>
            )}
            {(role === "Analyst" || role === "Admin") && (
              <Link
                to="/analyst"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-medium">{t("Fairness Hub")}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">/analyst</span>
              </Link>
            )}
            {role === "Admin" && (
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-medium">{t("Admin Ops")}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">/admin</span>
              </Link>
            )}
          </div>

          {/* Language Selector in Dropdown */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("Language")}
              </span>
              <button
                type="button"
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer"
              >
                {showLangPicker ? t("Hide List", "Hide List") : t("Change Language", "Change Language")}
              </button>
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-base">{currentLanguage.flag}</span>
                <span className="font-medium text-white">{currentLanguage.nativeName}</span>
                <span className="text-slate-400 text-[10px]">({currentLanguage.name})</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                {t("Active", "Active")}
              </span>
            </div>

            {/* Expandable Language Picker */}
            {showLangPicker && (
              <div className="max-h-40 overflow-y-auto custom-scroll space-y-0.5 p-1 rounded-lg bg-slate-950 border border-slate-800">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setShowLangPicker(false);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors cursor-pointer ${
                      currentLanguage.code === lang.code
                        ? "bg-emerald-500/20 text-emerald-300 font-bold"
                        : "text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{lang.flag}</span>
                      <span className="text-[11px]">{lang.nativeName}</span>
                      <span className="text-[10px] text-slate-500">({lang.name})</span>
                    </div>
                    {currentLanguage.code === lang.code && (
                      <Check className="w-3 h-3 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Security & Isolation Status */}
          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{t("Presidio Vault Encrypted")}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center gap-1.5 text-blue-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{t("Cedar RBAC Enforced")}</span>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold transition-colors cursor-pointer text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("Sign Out")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
