import translations, { Locale, TranslationKey } from "./translations";

/**
 * The weekly AI summary edge function returns mostly LLM-generated prose,
 * but a few canned fallback phrases are emitted when there are no trades
 * or the AI provider is unavailable. We map those known English strings
 * to the active locale on the client so the user always reads their own
 * language. Anything we don't recognize is returned untouched.
 */
const CANNED_PHRASE_TO_KEY: Array<[string, TranslationKey]> = [
  [
    "No closed trades this week. Consider reviewing your watchlist and setup criteria — discipline in waiting for high-quality setups is a skill.",
    "weekly.empty",
  ],
  ["Unable to generate summary.", "weekly.unavailable"],
];

export const localizeWeeklySummary = (raw: string | null | undefined, locale: Locale): string => {
  if (!raw) return "";
  const trimmed = raw.trim();
  for (const [source, key] of CANNED_PHRASE_TO_KEY) {
    if (trimmed === source) {
      return translations[locale]?.[key] ?? translations.en[key] ?? trimmed;
    }
  }
  return raw;
};
