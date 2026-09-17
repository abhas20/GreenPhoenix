import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage, SUPPORTED_LANGUAGES } from "../../context/LanguageContext";

export const LanguageDropdown: React.FC = () => {
  const { currentLanguage, setLanguage, isTranslationActive } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
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

  const indianLanguages = SUPPORTED_LANGUAGES.filter((l) => l.isIndian);
  const globalLanguages = SUPPORTED_LANGUAGES.filter((l) => !l.isIndian);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
          isTranslationActive
            ? "bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
            : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-850"
        }`}
      >
        <span className="text-sm shrink-0">{currentLanguage.flag}</span>
        <span className="font-semibold text-[11px] sm:text-xs truncate max-w-[70px] sm:max-w-none">
          {currentLanguage.nativeName}
        </span>
        {isTranslationActive && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Auto-Translate active" />
        )}
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 max-h-96 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 text-xs divide-y divide-slate-800">
          <div className="pb-2">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Indian Languages (भारतीय भाषाएं)
            </div>
            <div className="space-y-0.5 mt-1">
              {indianLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left ${
                    currentLanguage.code === lang.code
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span className="font-medium text-slate-100">{lang.nativeName}</span>
                    <span className="text-slate-400 text-[11px]">({lang.name})</span>
                  </div>
                  {currentLanguage.code === lang.code && (
                    <span className="text-emerald-400 text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Global Languages
            </div>
            <div className="space-y-0.5 mt-1">
              {globalLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left ${
                    currentLanguage.code === lang.code
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span className="font-medium text-slate-100">{lang.nativeName}</span>
                    <span className="text-slate-400 text-[11px]">({lang.name})</span>
                  </div>
                  {currentLanguage.code === lang.code && (
                    <span className="text-emerald-400 text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
