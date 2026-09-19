import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Compass,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  Lock,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { ProfileDropdown } from "./ProfileDropdown";
import { LanguageDropdown } from "./LanguageDropdown";
import { QuickExitButton } from "./QuickExitButton";

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = user !== null && role !== "PublicApplicant";

  // Base links: Only Public Applicant sees "Crisis Intake"
  const baseLinks = [
    { to: "/", label: t("Overview"), icon: Compass },
    ...(!isStaff
      ? [{ to: "/crisis", label: t("Crisis Intake"), icon: Sparkles, highlight: true }]
      : []),
    { to: "/programs", label: t("Aid Directory"), icon: BookOpen },
  ];

  // Sensitive staff links displayed strictly if the current role is authorized
  const staffLinks: { to: string; label: string; icon: any }[] = [];
  if (role === "Caseworker" || role === "Admin") {
    staffLinks.push({ to: "/caseworker", label: t("Caseworker Desk"), icon: Users });
  }
  if (role === "Analyst" || role === "Admin") {
    staffLinks.push({ to: "/analyst", label: t("Fairness Hub"), icon: BarChart3 });
  }
  if (role === "Admin") {
    staffLinks.push({ to: "/admin", label: t("Admin Ops"), icon: Settings });
  }

  const handleSignOut = () => {
    logout();
    navigate("/");
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-3 sm:gap-4">
          {/* 1. Left: Brand Identity */}
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0 group select-none"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden p-0.5 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-all bg-slate-900 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="GreenPhoenix Logo"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                  GreenPhoenix
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
                  2.0
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-normal -mt-0.5 hidden xs:inline">
                {t("Community Aid Navigator")}
              </span>
            </div>
          </Link>

          {/* 2. Center: Navigation Links (Responsive) */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Public / Common Links */}
            {baseLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                      : link.highlight
                      ? "text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 hover:text-emerald-300 border border-emerald-500/20"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : ""}`} />
                  <span>{link.label}</span>
                  {link.highlight && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  )}
                </Link>
              );
            })}

            {/* Staff Links (Only visible if role has access) */}
            {staffLinks.length > 0 && (
              <>
                <div className="h-4 w-px bg-slate-800 mx-1" />
                {staffLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                          : "text-slate-300 hover:bg-slate-850 hover:text-white border border-transparent"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-400" : ""}`} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* 3. Right: Clean Actions (Profile Dropdown or Staff Sign In) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Quick Exit (Safety button, visible on all screens) */}
            <QuickExitButton />

            {/* Authenticated Staff: Compact Profile Avatar Dropdown */}
            {isStaff ? (
              <ProfileDropdown />
            ) : (
              /* Citizen / Public Applicant: Language Dropdown + Staff Login Button */
              <div className="flex items-center gap-2">
                <LanguageDropdown />
                <Link
                  to="/login"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    location.pathname === "/login" || location.pathname === "/register"
                      ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20"
                      : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("Staff Login")}</span>
                  <span className="sm:hidden">{t("Login", "Login")}</span>
                </Link>
              </div>
            )}

            {/* Mobile / Tablet Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800/80 bg-slate-950/98 backdrop-blur-2xl px-4 py-4 space-y-3 animate-fade-in shadow-2xl">
          {/* Active Role badge in mobile menu */}
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">{t("Active Identity:")}</span>
            <span className="font-bold text-white">
              {!isStaff ? t("Public Applicant") : `${role} (${user?.name})`}
            </span>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
            {t("Navigation Menu", "Navigation Menu")}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {baseLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-200 hover:bg-slate-900 border border-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                    <span>{link.label}</span>
                  </div>
                  {link.highlight && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                      {t("Crisis Hub", "Crisis Hub")}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Staff links in mobile menu if authorized */}
            {staffLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      : "text-slate-200 hover:bg-slate-900 border border-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                    <span>{link.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Auth Button on Mobile */}
          <div className="pt-2 border-t border-slate-800/60">
            {!isStaff ? (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t("Staff Sign In / Register", "Staff Sign In / Register")}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-300 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t("Sign Out")} ({user?.name})</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
