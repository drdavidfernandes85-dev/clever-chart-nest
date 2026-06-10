import { Turnstile } from "@marsidev/react-turnstile";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  /**
   * Bump this value (e.g. setResetKey(k => k + 1)) to force the widget to
   * fully remount and request a fresh challenge after a submit.
   */
  resetKey?: number;
}

/**
 * Cloudflare Turnstile CAPTCHA widget.
 * Site key is read from VITE_TURNSTILE_SITE_KEY at build time.
 */
export const TurnstileWidget = ({ onVerify, onExpire, resetKey = 0 }: Props) => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const { theme } = useTheme();
  const { locale } = useLanguage();

  if (!siteKey) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
        CAPTCHA: define <code>VITE_TURNSTILE_SITE_KEY</code>.
      </div>
    );
  }

  const tsLang = locale === "pt" ? "pt-br" : locale === "en" ? "en" : "es";

  return (
    <div className="flex justify-center">
      <Turnstile
        key={resetKey}
        siteKey={siteKey}
        onSuccess={onVerify}
        onExpire={onExpire}
        options={{
          theme: theme === "light" ? "light" : "dark",
          size: "flexible",
          language: tsLang,
        }}
      />
    </div>
  );
};

export default TurnstileWidget;
