import type { Locale } from "@/i18n/translations";

/**
 * Maps the in-app Locale ("en" | "es" | "pt") to the canonical DB
 * preferred_language string used by the email automation system
 * (Brevo / nurture sequence). We store "pt-BR" instead of "pt" so the
 * downstream automation can match BCP-47 language tags directly.
 */
export const localeToPreferredLanguage = (l: Locale): "en" | "es" | "pt-BR" => {
  if (l === "pt") return "pt-BR";
  if (l === "es") return "es";
  return "en";
};

/**
 * Normalize any input to a valid preferred_language value.
 * Always returns one of: "en" | "es" | "pt-BR". Defaults to "es".
 */
export const normalizePreferredLanguage = (
  value: unknown
): "en" | "es" | "pt-BR" => {
  if (typeof value !== "string") return "es";
  const v = value.trim().toLowerCase();
  if (v === "en" || v.startsWith("en-")) return "en";
  if (v === "pt" || v === "pt-br" || v.startsWith("pt-")) return "pt-BR";
  if (v === "es" || v.startsWith("es-")) return "es";
  return "es";
};
