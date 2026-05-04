import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import translations, { Locale, TranslationKey } from "./translations";
import { supabase } from "@/integrations/supabase/client";
import { localeToPreferredLanguage } from "@/lib/preferredLanguage";
import { track } from "@/lib/analytics";

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

const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (v === "en" || v === "es" || v === "pt");

/**
 * Dev-only: log keys that are present in EN but missing in the target locale.
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
  // Track which user we've already hydrated from to avoid clobbering
  // an in-session user choice with a stale profile fetch.
  const hydratedForUserRef = useRef<string | null>(null);

  // Audit on mount + every locale change (dev-only).
  useEffect(() => {
    auditMissingKeys(previousLocaleRef.current, locale);
    previousLocaleRef.current = locale;
  }, [locale]);

  const persistToProfile = useCallback(async (l: Locale) => {
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      await supabase
        .from("profiles")
        .update({ preferred_language: l })
        .eq("user_id", uid);
    } catch {
      // best-effort; localStorage is the fallback
    }
  }, []);

  const setLocale = useCallback(
    (l: Locale) => {
      setLocaleState(l);
      localStorage.setItem("locale", l);
      if (typeof document !== "undefined") {
        document.documentElement.lang = l;
      }
      // Fire-and-forget DB write
      void persistToProfile(l);
    },
    [persistToProfile]
  );

  // Keep <html lang> in sync with current locale on mount/changes.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Cross-tab sync via localStorage.
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

  // Hydrate from Supabase profile on sign-in, so a user's preferred
  // language follows them across devices. Only runs once per user id.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async (userId: string) => {
      if (hydratedForUserRef.current === userId) return;
      hydratedForUserRef.current = userId;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("preferred_language")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled || error || !data) return;
        const remote = data.preferred_language;
        if (isLocale(remote) && remote !== locale) {
          setLocaleState(remote);
          localStorage.setItem("locale", remote);
          if (typeof document !== "undefined") document.documentElement.lang = remote;
        }
      } catch {
        // ignore — falls back to localStorage value
      }
    };

    // Initial check
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) hydrate(data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        hydratedForUserRef.current = null; // allow re-hydrate for new user
        hydrate(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        hydratedForUserRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // Intentionally only run once on mount; locale value is read fresh inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
