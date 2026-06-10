import { Turnstile } from "@marsidev/react-turnstile";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

/**
 * Cloudflare Turnstile CAPTCHA widget.
 * Site key is read from VITE_TURNSTILE_SITE_KEY at build time.
 * If the key is missing, renders a small notice (and the parent form should
 * treat the CAPTCHA as not yet completed).
 */
export const TurnstileWidget = ({ onVerify, onExpire }: Props) => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const { theme } = useTheme();

  if (!siteKey) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
        CAPTCHA no configurado. Define <code>VITE_TURNSTILE_SITE_KEY</code> para activarlo.
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onVerify}
        onExpire={onExpire}
        options={{ theme: theme === "light" ? "light" : "dark", size: "flexible" }}
      />
    </div>
  );
};

export default TurnstileWidget;
