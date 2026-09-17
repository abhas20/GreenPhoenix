import React, { createContext, useContext, useState, useEffect } from "react";

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isIndian?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  // Indian Languages
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", isIndian: true },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳", isIndian: true },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", isIndian: true },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", isIndian: true },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", isIndian: true },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", isIndian: true },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳", isIndian: true },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇮🇳", isIndian: true },
  // Global Languages
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇲🇽" },
  { code: "zh", name: "Mandarin", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl Ayisyen", flag: "🇭🇹" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
];

interface LanguageContextType {
  currentLanguage: LanguageOption;
  setLanguage: (code: string) => void;
  isTranslationActive: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCode, setSelectedCode] = useState<string>(() => {
    return localStorage.getItem("greenphoenix_lang") || "en";
  });

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedCode) || SUPPORTED_LANGUAGES[0];

  const setLanguage = (code: string) => {
    setSelectedCode(code);
    localStorage.setItem("greenphoenix_lang", code);
  };

  const isTranslationActive = currentLanguage.code !== "en";

  useEffect(() => {
    document.documentElement.lang = currentLanguage.code;
  }, [currentLanguage]);

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, isTranslationActive }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
