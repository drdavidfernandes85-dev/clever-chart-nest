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
