import { reviewAccessModeEnabled } from "@/lib/accessMode";
import type { Locale } from "@/i18n/translations";

/**
 * Temporary copy shown anywhere we would normally surface the
 * "$100 minimum net balance" eligibility requirement, while review/testing
 * access mode is active.
 *
 * Original i18n keys (hero.eligibility, access.eligibility.short,
 * access.intro, access.reason.low_balance, access.reason.unknown, banner
 * bodies) are intentionally kept untouched so they can be restored simply
 * by flipping `reviewAccessModeEnabled` back to false before production.
 */
const REVIEW_COPY: Record<Locale, string> = {
  en: "Platform access is currently open for review and testing. Certain live trading features may require a connected and verified MT5 account.",
  es: "El acceso a la plataforma está temporalmente abierto para revisión y pruebas. Algunas funciones de trading en vivo pueden requerir una cuenta MT5 conectada y verificada.",
  pt: "O acesso à plataforma está temporariamente aberto para revisão e testes. Alguns recursos de trading ao vivo podem exigir uma conta MT5 conectada e verificada.",
};

/**
 * Returns the review-mode wording when the flag is on, otherwise returns
 * the original (translated) eligibility copy.
 */
export function eligibilityCopy(locale: Locale, original: string): string {
  if (!reviewAccessModeEnabled) return original;
  return REVIEW_COPY[locale] ?? REVIEW_COPY.en;
}
