import React, { useState, useRef, useEffect } from "react";
import { UserCheck, ChevronDown, Sparkles } from "lucide-react";
import { useAuth, DEMO_PERSONAS } from "../../context/AuthContext";

export const PersonaSwitcher: React.FC = () => {
  const { activePersonaKey, switchPersona, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentPersona =
    DEMO_PERSONAS.find((p) => p.key === activePersonaKey) || DEMO_PERSONAS[0];

  const handleSelect = async (key: string) => {
    setIsSwitching(true);
    try {
      await switchPersona(key);
    } finally {
      setIsSwitching(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-850 transition-all cursor-pointer shadow-sm max-w-[140px] sm:max-w-[210px]"
        title="Quick Role Persona Switcher (For Evaluation & Demo)"
      >
        <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <div className="flex flex-col text-left truncate min-w-0">
          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 leading-none truncate">
            Role
          </span>
          <span className="font-semibold text-slate-100 text-[11px] sm:text-xs truncate mt-0.5">
            {currentPersona.label}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 text-xs divide-y divide-slate-800">
          <div className="px-2 py-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Instant Role Simulation
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Cedar Gate</span>
          </div>

          <div className="py-1 space-y-1">
            {DEMO_PERSONAS.map((persona) => {
              const isSelected = activePersonaKey === persona.key;
              return (
                <button
                  key={persona.key}
                  type="button"
                  onClick={() => handleSelect(persona.key)}
                  className={`w-full text-left p-2 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-200"
                      : "hover:bg-slate-800/80 text-slate-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100 text-xs">{persona.label}</span>
                    {isSelected && <span className="text-emerald-400 text-[11px]">Active</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{persona.name}</div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                    {persona.description}
                  </div>
                </button>
              );
            })}
          </div>

          {user && (
            <div className="pt-2 px-2 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Token: Bearer JWT active</span>
              {user.org_id && <span className="text-blue-300 font-mono">org: {user.org_id}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
