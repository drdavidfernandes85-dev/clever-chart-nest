import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import translations, { Locale, TranslationKey } from "./translations";

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const defaultT = (key: TranslationKey): string => translations.es?.[key] ?? translations.en[key] ?? key;

const LanguageContext = createContext<LanguageContextType>({
  locale: "es",
  setLocale: () => {},
  t: defaultT,
});

/**
 * In development, audit every locale for keys present in EN but missing
 * in the active locale. Logged once per (from→to) switch so devs can
 * quickly spot what is still untranslated. No-op in production.
 */
const auditMissingKeys = (from: Locale | null, to: Locale) => {
  if (!import.meta.env.DEV) return;
  const enKeys = Object.keys(translations.en) as TranslationKey[];
  const targetMap = translations[to] as Record<string, string> | undefined;
  if (!targetMap) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] Locale "${to}" has no translation map.`);
    return;
  }
  const missing = enKeys.filter((k) => !(k in targetMap));
  const label = from ? `${from} → ${to}` : `init: ${to}`;
  if (missing.length === 0) {
    // eslint-disable-next-line no-console
    console.info(`%c[i18n] ${label} — all ${enKeys.length} keys translated ✓`, "color:#22c55e");
  } else {
    // eslint-disable-next-line no-console
    console.group(
      `%c[i18n] ${label} — ${missing.length} missing key(s) (falling back to EN)`,
      "color:#f59e0b;font-weight:bold"
    );
    // eslint-disable-next-line no-console
    console.table(missing.map((k) => ({ key: k, en: translations.en[k] })));
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    return saved && translations[saved] ? saved : "es";
  });
  const previousLocaleRef = useRef<Locale | null>(null);

  // Audit on mount + every locale change (dev-only).
  useEffect(() => {
    auditMissingKeys(previousLocaleRef.current, locale);
    previousLocaleRef.current = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
    // Reflect on <html lang> for accessibility / SEO
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }, []);

  // Keep <html lang> in sync with current locale on mount/changes.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Cross-tab sync: if the user changes language in another tab/window,
  // mirror it here so the app stays consistent across the whole session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "locale" || !e.newValue) return;
      if (translations[e.newValue as Locale] && e.newValue !== locale) {
        setLocaleState(e.newValue as Locale);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey): string => {
      const value = translations[locale]?.[key];
      if (value !== undefined) return value;
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing "${key}" for locale "${locale}" — using EN fallback.`);
      }
      return translations.en[key] ?? key;
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  return useContext(LanguageContext);
};
