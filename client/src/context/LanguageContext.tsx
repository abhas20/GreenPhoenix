import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { translateService } from "../services/translateService";

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

/**
 * High-frequency baseline UI strings pre-loaded whenever a user selects a new language.
 * Ensures the main navigation, hero headlines, CTA buttons, and status indicators
 * translate immediately upon switching.
 */
export const CORE_UI_STRINGS: string[] = [
  // Navigation & Core Actions
  "Overview",
  "Crisis Intake",
  "Aid Directory",
  "Caseworker Desk",
  "Fairness Hub",
  "Admin Ops",
  "Staff Login",
  "Sign Out",
  "Quick Exit",
  "Active Identity:",
  "Authorized Portals",
  "Tenant Agency:",
  "Language",

  // Hero Section
  "Find the Emergency Aid You Deserve,",
  "Guaranteed Private & Fair.",
  "Next-Gen Multi-Agent Aid Navigation",
  "Presidio Vault & Cedar Gate Active",
  "Behind on rent, facing eviction, or struggling with groceries? Talk to our empathetic, multilingual crisis agent. We match you to official NYC and State benefits using deterministic eligibility checks—with zero data selling and complete PII encryption.",
  "Speak to Aid Navigator — Get Help Now",
  "Browse 50+ Aid Programs",
  "Zero Data Retention",
  "Statutory NYC Rules",
  "Multi-Tenant Isolation",
  "Mother-tongue support active:",
  "Chat freely in your language",

  // Program Ticker & Features
  "Live NYC Public Benefit Programs",
  "One Shot Deal",
  "SNAP Food Assistance",
  "CityFHEPS Rental Voucher",
  "HEAP Home Energy Subsidy",
  "SCRIE Senior Rent Increase Exemption",
  "Comprehensive Public Safety Net",
  "Deterministic Rule Verification",
  "No Hallucinations",
  "Presidio PII Vault",
  "AWS Cedar Authorization Gate",
  "Multi-Tenant Isolation Enforced",
  "OpenSearch Hybrid Vector Index",
  "Sub-Second Benefit Retrieval",
  "Automated Fairness & Disparate Impact Audits",
  "100% 4/5ths Rule Compliant",

  // Crisis Navigator Chat
  "Crisis Aid Navigator",
  "Direct, Private & Deterministic Assistance",
  "Presidio PII Sanitization Active",
  "Encrypted In-Memory Vault",
  "Type your emergency or question in any language...",
  "Send Message",
  "Chat Assistant",
  "Matches & Checklist",
  "Aid Intake Assistant",
  "Empathetic multi-agent intake & fact extraction",
  "GreenPhoenix Navigator",
  "You",
  "Hello. I am your confidential Community Aid Navigator. I am here to help you find and apply for emergency housing, food, cash, and utility assistance in New York City.",
  "Please describe your situation in your own words—whether you are behind on rent, lost income, or need help paying for groceries. All personal identifiers (names, phone numbers, addresses) are automatically encrypted before processing.",
  "I need help with rent arrears",
  "Facing eviction notice",
  "Need emergency food / SNAP",
  "Utility shut-off assistance",
  "Extracted Profile",
  "Verified Benefit Matches",
  "Required Documents",
  "Clear Session & Reset",

  // Roles & Security
  "Public Applicant",
  "Caseworker",
  "Policy Analyst",
  "System Administrator",
  "Role:",
  "Presidio Vault Encrypted",
  "Cedar RBAC Enforced",
];

interface LanguageContextType {
  currentLanguage: LanguageOption;
  setLanguage: (code: string) => void;
  isTranslationActive: boolean;
  isTranslating: boolean;
  t: (text: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCode, setSelectedCode] = useState<string>(() => {
    return localStorage.getItem("greenphoenix_lang") || "en";
  });

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedCode) || SUPPORTED_LANGUAGES[0];

  const [dictionary, setDictionary] = useState<Record<string, string>>(() => {
    if (selectedCode === "en") return {};
    try {
      const saved = localStorage.getItem(`greenphoenix_i18n_${selectedCode}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Missing text queue for runtime self-learning extraction
  const missingQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<any>(null);

  // Synchronize document language tag
  useEffect(() => {
    document.documentElement.lang = currentLanguage.code;
  }, [currentLanguage]);

  // Load language translations whenever currentLanguage changes
  useEffect(() => {
    if (currentLanguage.code === "en") {
      setDictionary({});
      return;
    }

    // 1. Check local storage first for instantaneous UI rendering
    let localDict: Record<string, string> = {};
    try {
      const saved = localStorage.getItem(`greenphoenix_i18n_${currentLanguage.code}`);
      if (saved) {
        localDict = JSON.parse(saved);
        setDictionary(localDict);
      }
    } catch {
      // ignore parse error
    }

    // 2. Fetch server Redis cache & translate core baseline UI strings in background
    let isMounted = true;
    setIsTranslating(true);

    (async () => {
      try {
        // Hydrate from server cache
        const serverCache = await translateService.getLanguageCache(currentLanguage.code);
        const mergedInitial = { ...localDict, ...serverCache };

        // Identify which core UI strings are not yet in cache
        const uncached = CORE_UI_STRINGS.filter((s) => !mergedInitial[s]);

        let newlyTranslated: Record<string, string> = {};
        if (uncached.length > 0) {
          newlyTranslated = await translateService.translateBatch(
            uncached,
            currentLanguage.code
          );
        }

        const completeDict = { ...mergedInitial, ...newlyTranslated };
        if (isMounted) {
          setDictionary(completeDict);
          try {
            localStorage.setItem(
              `greenphoenix_i18n_${currentLanguage.code}`,
              JSON.stringify(completeDict)
            );
          } catch {
            // ignore localStorage quota limit
          }
        }
      } catch (err) {
        console.warn("[LanguageProvider] Translation hydration failed:", err);
      } finally {
        if (isMounted) setIsTranslating(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentLanguage.code]);

  // Flush missing texts queue to backend
  const flushMissingQueue = useCallback(async () => {
    if (currentLanguage.code === "en") return;
    const items = Array.from(missingQueueRef.current);
    missingQueueRef.current.clear();

    if (items.length === 0) return;

    try {
      const translated = await translateService.translateBatch(items, currentLanguage.code);
      setDictionary((prev) => {
        const next = { ...prev, ...translated };
        try {
          localStorage.setItem(
            `greenphoenix_i18n_${currentLanguage.code}`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        return next;
      });
    } catch (err) {
      console.warn("[LanguageProvider] Missing strings batch failed:", err);
    }
  }, [currentLanguage.code]);

  // Translation lookup function
  const t = useCallback(
    (text: string, fallback?: string): string => {
      if (!text) return "";
      if (currentLanguage.code === "en") return text;

      // 1. Return from active dictionary if present
      if (dictionary[text]) {
        return dictionary[text];
      }

      // 2. If missing, queue for background batch translation
      if (!missingQueueRef.current.has(text)) {
        missingQueueRef.current.add(text);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          flushMissingQueue();
        }, 200);
      }

      // 3. Fallback to provided fallback or original English while fetching
      return fallback || text;
    },
    [currentLanguage.code, dictionary, flushMissingQueue]
  );

  const setLanguage = (code: string) => {
    setSelectedCode(code);
    localStorage.setItem("greenphoenix_lang", code);
  };

  const isTranslationActive = currentLanguage.code !== "en";

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        isTranslationActive,
        isTranslating,
        t,
      }}
    >
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

/**
 * Lightweight JSX component wrapper for translating text inline.
 * Example: <T>Find the Emergency Aid You Deserve</T>
 */
export const T: React.FC<{ children: string; fallback?: string }> = ({
  children,
  fallback,
}) => {
  const { t } = useLanguage();
  return <>{t(children, fallback)}</>;
};
