import { useLanguage } from "@/i18n/LanguageContext";
import { LOCALE_FLAGS, LOCALE_LABELS, Locale } from "@/i18n/translations";

const locales: Locale[] = ["en", "es", "pt"];

const LanguageSwitcher = () => {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border/50 bg-secondary/50 p-0.5">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
            locale === l
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={LOCALE_LABELS[l]}
        >
          <span>{LOCALE_FLAGS[l]}</span>
          <span className="hidden sm:inline">{l.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
