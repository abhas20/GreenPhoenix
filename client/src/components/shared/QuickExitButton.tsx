import React from "react";
import { LogOut } from "lucide-react";
import { chatService } from "../../services/chatService";

export const QuickExitButton: React.FC = () => {
  const handleQuickExit = async () => {
    try {
      await chatService.deleteSession();
    } catch {
      // ignore network errors on emergency exit
    }
    // Instantly replace window location to clear history
    window.location.replace("https://www.google.com");
  };

  return (
    <button
      type="button"
      onClick={handleQuickExit}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow-sm"
      title="Emergency Quick Exit: Instantly close this page, clear session, and navigate to Google"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>Quick Exit</span>
    </button>
  );
};
