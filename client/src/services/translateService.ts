import { api } from "./api";

export interface BatchTranslateResponse {
  target_language: string;
  translations: Record<string, string>;
  cached_count: number;
  newly_translated_count: number;
}

export const translateService = {
  /**
   * Translates an array of English strings into the target language.
   * Leverages backend Redis hash caching.
   */
  async translateBatch(
    texts: string[],
    targetLanguage: string
  ): Promise<Record<string, string>> {
    if (!texts.length || targetLanguage === "en") {
      const identity: Record<string, string> = {};
      for (const t of texts) {
        identity[t] = t;
      }
      return identity;
    }

    try {
      const res = await api.post<BatchTranslateResponse>("/translate/batch", {
        texts,
        target_language: targetLanguage,
      });
      return res.translations || {};
    } catch (err) {
      console.warn(`[translateService] Batch translation to ${targetLanguage} failed:`, err);
      // Fallback: return original English texts
      const fallback: Record<string, string> = {};
      for (const t of texts) {
        fallback[t] = t;
      }
      return fallback;
    }
  },

  /**
   * Retrieves all cached translations for a language to hydrate UI quickly.
   */
  async getLanguageCache(targetLanguage: string): Promise<Record<string, string>> {
    if (targetLanguage === "en") return {};
    try {
      return await api.get<Record<string, string>>(`/translate/cache/${targetLanguage}`);
    } catch (err) {
      console.warn(`[translateService] Cache fetch for ${targetLanguage} failed:`, err);
      return {};
    }
  },

  /**
   * Retrieves list of supported languages from backend.
   */
  async getSupportedLanguages(): Promise<Record<string, string>> {
    try {
      return await api.get<Record<string, string>>("/translate/languages");
    } catch {
      return {};
    }
  },
};
