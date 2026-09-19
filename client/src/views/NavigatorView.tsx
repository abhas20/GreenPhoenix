import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  RotateCcw,
  Shield,
  FileCheck,
  CheckCircle2,
  FileText,
  UserCheck,
  Loader2,
  Globe,
  AlertCircle,
  MessageSquare,
  Layers,
} from "lucide-react";
import type { SessionHistoryItem, ApplicantProfile } from "../types/chat";
import type { MatchingResult, ApplicationDraft } from "../types/program";
import { chatService } from "../services/chatService";
import { useLanguage } from "../context/LanguageContext";
import { MessageBubble } from "../components/navigator/MessageBubble";
import { SuggestedPrompts } from "../components/navigator/SuggestedPrompts";
import { ProgramMatchCard } from "../components/navigator/ProgramMatchCard";
import { DocumentChecklist } from "../components/navigator/DocumentChecklist";
import { HardshipDraft } from "../components/navigator/HardshipDraft";
import { ProfileFactSheet } from "../components/navigator/ProfileFactSheet";

const INITIAL_WELCOME: SessionHistoryItem = {
  role: "assistant",
  content:
    "Hello. I am your confidential Community Aid Navigator. I am here to help you find and apply for emergency housing, food, cash, and utility assistance in New York City.\n\nPlease describe your situation in your own words—whether you are behind on rent, lost income, or need help paying for groceries. All personal identifiers (names, phone numbers, addresses) are automatically encrypted before processing.",
  timestamp: new Date().toISOString(),
};

const DEFAULT_PROFILE: ApplicantProfile = {
  preferred_language: "en",
  primary_needs: [],
  missing_critical_fields: ["borough", "income"],
  summary: "New applicant",
};

export const NavigatorView: React.FC = () => {
  const { currentLanguage, isTranslationActive, t } = useLanguage();

  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<SessionHistoryItem[]>([INITIAL_WELCOME]);
  const [profile, setProfile] = useState<ApplicantProfile>(DEFAULT_PROFILE);
  const [matchingResult, setMatchingResult] = useState<MatchingResult | null>(null);
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matches" | "checklist" | "hardship" | "profile">("matches");
  const [mobilePane, setMobilePane] = useState<"chat" | "results">("chat");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Rehydrate existing session on mount
  useEffect(() => {
    chatService
      .getCurrentSession()
      .then((session) => {
        if (session) {
          if (session.history && session.history.length > 0) {
            setMessages(session.history);
          }
          if (session.applicant_profile) {
            setProfile(session.applicant_profile);
          }
          if (session.matching_result) {
            setMatchingResult(session.matching_result);
          }
          if (session.application_draft) {
            setApplicationDraft(session.application_draft);
          }
        }
      })
      .catch((err) => {
        console.warn("Session rehydration check (unseeded session is normal):", err);
      });
  }, []);

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputMessage).trim();
    if (!text || loading) return;

    setInputMessage("");
    setError(null);

    const userMsg: SessionHistoryItem = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await chatService.sendTurn(text, currentLanguage.code);

      const botMsg: SessionHistoryItem = {
        role: "assistant",
        content: res.reply_message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMsg]);
      setProfile(res.applicant_profile);

      if (res.matching_result) {
        setMatchingResult(res.matching_result);
      }
      if (res.application_draft) {
        setApplicationDraft(res.application_draft);
      }

      // If new matches found, switch tab to matches
      if (res.matching_result?.ranked_programs?.length) {
        setActiveTab("matches");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process turn. Please verify backend connection.");
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetSession = async () => {
    if (window.confirm("Are you sure you want to clear this conversation and reset your session?")) {
      try {
        await chatService.deleteSession();
      } catch {
        // ignore
      }
      setMessages([INITIAL_WELCOME]);
      setProfile(DEFAULT_PROFILE);
      setMatchingResult(null);
      setApplicationDraft(null);
      setError(null);
    }
  };

  const matchCount = matchingResult?.ranked_programs?.length || 0;
  const docCount = applicationDraft?.consolidated_checklist?.length || 0;

  return (
    <div className="w-full max-w-full px-3 sm:px-5 lg:px-8 py-3 sm:py-4 flex flex-col overflow-x-hidden min-h-[calc(100vh-10rem)]">
      {/* Mobile Pane Toggle (visible only on screens < lg) */}
      <div className="lg:hidden flex items-center justify-center p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-3 shrink-0">
        <button
          type="button"
          onClick={() => setMobilePane("chat")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobilePane === "chat"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{t("Chat Assistant", "Chat Assistant")}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobilePane("results")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobilePane === "results"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t("Matches & Checklist", "Matches & Checklist")}</span>
          {matchCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-400/20 text-emerald-300">
              {matchCount}
            </span>
          )}
        </button>
      </div>

      {/* Responsive Split View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 w-full max-w-full h-auto lg:h-[calc(100vh-8.75rem)] lg:min-h-[580px] min-w-0">
        {/* ========================================================= */}
        {/* LEFT PANE: Conversational Aid Assistant                    */}
        {/* ========================================================= */}
        <div
          className={`flex flex-col h-[580px] sm:h-[640px] lg:h-full w-full min-w-0 bg-slate-900/85 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl ${
            mobilePane === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Left Header */}
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <span>{t("Aid Intake Assistant", "Aid Intake Assistant")}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-[11px] text-slate-400 -mt-0.5">
                  {t("Empathetic multi-agent intake & fact extraction", "Empathetic multi-agent intake & fact extraction")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetSession}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
              title="Purge session history"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("Reset")}</span>
            </button>
          </div>

          {/* Privacy & Translation Banners */}
          <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5 text-emerald-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t("Presidio PII Vault Active (Zero raw names/SSNs stored)", "Presidio PII Vault Active (Zero raw names/SSNs stored)")}</span>
            </div>
            {isTranslationActive && (
              <div className="flex items-center gap-1 text-amber-300 font-medium">
                <Globe className="w-3 h-3" />
                <span>{currentLanguage.nativeName} ⇄ English {t("Auto-Translate active", "auto-translation")}</span>
              </div>
            )}
          </div>

          {/* Messages Scroll Area with custom visible scrollbar */}
          <div className="flex-1 overflow-y-auto custom-scroll px-3 sm:px-4 py-4 space-y-2 min-h-0">
            {messages.map((msg, index) => (
              <MessageBubble key={index} message={msg} />
            ))}

            {loading && (
              <MessageBubble
                message={{
                  role: "assistant",
                  content: t(
                    "Analyzing your request, checking statutory criteria, and extracting profile facts...",
                    "Analyzing your request, checking statutory criteria, and extracting profile facts..."
                  ),
                  timestamp: new Date().toISOString(),
                }}
                isStreaming
              />
            )}

            {error && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Inquiries */}
          {messages.length <= 3 && (
            <div className="px-4 pb-2 shrink-0">
              <SuggestedPrompts
                disabled={loading}
                onSelectPrompt={(text) => handleSendMessage(text)}
              />
            </div>
          )}

          {/* Input Box */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 shrink-0">
            <div className="relative flex items-end gap-2 bg-slate-900 border border-slate-700 rounded-2xl p-2 focus-within:border-emerald-500 transition-colors shadow-inner">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={2}
                placeholder={
                  isTranslationActive
                    ? `${t("Type your situation in", "Type your situation in")} ${currentLanguage.nativeName} (e.g. rent, food, bills)...`
                    : t("Describe your situation (e.g. Behind on rent in Brooklyn, making $28,000, 2 children)...")
                }
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 resize-none focus:outline-none px-2 py-1 leading-relaxed"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={loading || !inputMessage.trim()}
                className="p-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-emerald-500/20 shrink-0"
                title={t("Send Message", "Send Message")}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 mt-1.5">
              <span>{t("Press Enter to send, Shift + Enter for new line")}</span>
              <span>{t("100% Confidential & Free")}</span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANE: Dynamic Match Results & Application Hub       */}
        {/* ========================================================= */}
        <div
          className={`flex flex-col h-[580px] sm:h-[640px] lg:h-full w-full min-w-0 bg-slate-900/85 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl ${
            mobilePane === "results" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Tab Navigation */}
          <div className="px-4 pt-3 pb-2 border-b border-slate-800 bg-slate-950/60 shrink-0 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {/* Tab 1: Matches */}
              <button
                type="button"
                onClick={() => setActiveTab("matches")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "matches"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t("Verified Benefit Matches", "Eligible Aid")}</span>
                {matchCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      activeTab === "matches"
                        ? "bg-slate-950 text-emerald-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {matchCount}
                  </span>
                )}
              </button>

              {/* Tab 2: Document Checklist */}
              <button
                type="button"
                onClick={() => setActiveTab("checklist")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "checklist"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>{t("Required Documents", "Checklist")}</span>
                {docCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      activeTab === "checklist"
                        ? "bg-slate-950 text-emerald-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {docCount}
                  </span>
                )}
              </button>

              {/* Tab 3: Hardship Draft */}
              <button
                type="button"
                onClick={() => setActiveTab("hardship")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "hardship"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t("Hardship Statements", "Hardship Letter")}</span>
              </button>

              {/* Tab 4: Profile Facts */}
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{t("Extracted Profile", "Profile")}</span>
              </button>
            </div>
          </div>

          {/* Right Tab Content Scrollable Body with custom scrollbar */}
          <div className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-5 min-h-0 space-y-4">
            {/* TAB 1: MATCHES */}
            {activeTab === "matches" && (
              <div className="space-y-4">
                {matchCount > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {t("Found")} <strong className="text-white">{matchCount}</strong> {t("qualified programs")}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400">
                        {t("Evaluated")} {matchingResult?.total_candidates_evaluated || 12} {t("candidates")}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {matchingResult!.ranked_programs.map((match) => (
                        <ProgramMatchCard key={match.program_id} match={match} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-16 text-center text-slate-400 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-white">{t("Live Matches Will Appear Here")}</h4>
                    <p className="text-xs max-w-sm mx-auto leading-relaxed text-slate-400">
                      {t("As you converse with the assistant on the left, our deterministic matching agent will investigate NYC aid databases and display verified benefits here.")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CHECKLIST */}
            {activeTab === "checklist" && (
              <DocumentChecklist items={applicationDraft?.consolidated_checklist || []} />
            )}

            {/* TAB 3: HARDSHIP DRAFT */}
            {activeTab === "hardship" && <HardshipDraft draft={applicationDraft} />}

            {/* TAB 4: PROFILE FACTS */}
            {activeTab === "profile" && <ProfileFactSheet profile={profile} />}
          </div>
        </div>
      </div>
    </div>
  );
};
