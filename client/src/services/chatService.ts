import { api } from "./api";
import type { ChatTurnResponse, SessionState } from "../types/chat";

export const chatService = {
  async sendTurn(message: string, language?: string): Promise<ChatTurnResponse> {
    return api.post<ChatTurnResponse>("/chat/turn", {
      message,
      language: language || "en",
    });
  },

  async getCurrentSession(): Promise<SessionState> {
    return api.get<SessionState>("/chat/session");
  },

  async getSessionById(sessionId: string): Promise<SessionState> {
    return api.get<SessionState>(`/chat/session/${sessionId}`);
  },

  async deleteSession(): Promise<{ status: string; message: string }> {
    return api.delete<{ status: string; message: string }>("/chat/session");
  },

  async deleteSessionById(sessionId: string): Promise<{ status: string; message: string }> {
    return api.delete<{ status: string; message: string }>(`/chat/session/${sessionId}`);
  },
};
