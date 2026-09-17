import React, { useState } from "react";
import {
  Sparkles,
  Compass,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  Shield,
  Lock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PiiShield } from "./PiiShield";
import { CedarBadge } from "./CedarBadge";
import { LanguageDropdown } from "./LanguageDropdown";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { QuickExitButton } from "./QuickExitButton";

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: "home", label: "Overview", icon: Compass },
    { id: "navigator", label: "Crisis Intake", icon: Sparkles, highlight: true },
    { id: "programs", label: "Aid Directory", icon: BookOpen },
  ];

  if (role === "Caseworker" || role === "Admin") {
    navLinks.push({ id: "caseworker", label: "Caseworker Desk", icon: Users, highlight: false });
  }
  if (role === "Analyst" || role === "Admin") {
    navLinks.push({ id: "analyst", label: "Fairness Hub", icon: BarChart3, highlight: false });
  }
  if (role === "Admin") {
    navLinks.push({ id: "admin", label: "Admin Ops", icon: Settings, highlight: false });
  }

  const handleNavClick = (viewId: string) => {
    onNavigate(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
      {/* Full width container spanning edge to edge */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-3 sm:gap-6">
          {/* 1. Left: Brand Identity */}
          <div
            className="flex items-center gap-3 cursor-pointer shrink-0 group select-none"
            onClick={() => handleNavClick("home")}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden p-0.5 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-all bg-slate-900 border border-emerald-500/30 flex items-center justify-center shrink-0">
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
                Community Aid Navigator
              </span>
            </div>
          </div>

          {/* 2. Center: Primary Navigation Links (Desktop only when ample room) */}
          <nav className="hidden xl:flex items-center gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentView === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNavClick(link.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                </button>
              );
            })}
          </nav>

          {/* 3. Right: Security Badges, Language, Persona Switcher & Quick Exit */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Status Pills (visible on 2xl+ to avoid crowding) */}
            <div className="hidden 2xl:flex items-center gap-2">
              <PiiShield compact />
              <CedarBadge />
            </div>

            {/* Language Selector */}
            <LanguageDropdown />

            {/* Role Switcher */}
            <PersonaSwitcher />

            {/* Quick Exit */}
            <div className="hidden sm:block">
              <QuickExitButton />
            </div>

            {/* Mobile / Tablet Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-2xl px-4 py-4 space-y-3 animate-fade-in shadow-2xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
            Navigation Menu
          </div>
          <div className="grid grid-cols-1 gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentView === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNavClick(link.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
                      Crisis Hub
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Security details on mobile */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
              System Security & Authorization
            </div>
            <div className="flex flex-wrap items-center gap-2 px-1">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                <Shield className="w-3.5 h-3.5" />
                <span>Presidio PII Vault Active</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/30">
                <Lock className="w-3.5 h-3.5" />
                <span>Cedar Gate: {role}</span>
              </div>
            </div>
          </div>

          {/* Quick Exit on mobile */}
          <div className="pt-2 sm:hidden">
            <QuickExitButton />
          </div>
        </div>
      )}
    </header>
  );
};
