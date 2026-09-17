import React from "react";
import { Bot, User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { SessionHistoryItem } from "../../types/chat";

interface MessageBubbleProps {
  message: SessionHistoryItem;
  isStreaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming }) => {
  const isAssistant = message.role === "assistant" || message.role === "system";

  return (
    <div
      className={`flex items-start gap-3 my-3.5 text-sm animate-fade-in ${
        isAssistant ? "justify-start" : "justify-end"
      }`}
    >
      {isAssistant && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md shadow-emerald-500/20 shrink-0 mt-0.5">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      )}

      <div
        className={`relative max-w-[90%] sm:max-w-[82%] rounded-2xl p-4 shadow-sm ${
          isAssistant
            ? "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm"
            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-sm shadow-emerald-500/10"
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-white/10">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isAssistant ? "text-emerald-400" : "text-slate-950/80"
            }`}
          >
            {isAssistant ? "GreenPhoenix Navigator" : "You"}
          </span>
          {message.timestamp && (
            <span
              className={`text-[10px] ${
                isAssistant ? "text-slate-400" : "text-slate-900/70 font-mono"
              }`}
            >
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Markdown-rendered message content */}
        {isAssistant ? (
          <div className="text-sm leading-relaxed space-y-2 prose-invert prose-emerald">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 pl-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 pl-1">{children}</ol>,
                li: ({ children }) => <li className="text-slate-300 text-xs sm:text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                em: ({ children }) => <em className="italic text-emerald-300">{children}</em>,
                h1: ({ children }) => <h3 className="font-bold text-base text-white mt-2 mb-1">{children}</h3>,
                h2: ({ children }) => <h4 className="font-bold text-sm text-emerald-300 mt-2 mb-1">{children}</h4>,
                h3: ({ children }) => <h5 className="font-semibold text-xs text-teal-300 mt-1.5 mb-1">{children}</h5>,
                code: ({ children }) => (
                  <code className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs">
                    {children}
                  </code>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 underline hover:text-emerald-300 font-semibold"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="leading-relaxed whitespace-pre-wrap break-words text-slate-950 font-medium">
            {message.content}
          </div>
        )}

        {isStreaming && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Formulating compassionate response & checking statutory rules...</span>
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-slate-300">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
