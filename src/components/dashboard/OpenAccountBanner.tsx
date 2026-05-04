import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { track } from "@/lib/analytics";
import type { Locale } from "@/i18n/translations";

const INFINOX_URL = "https://myaccount.infinox.com/es/links/go/9926281";
const STORAGE_KEY = "ix.dashboard.openAccountBanner.dismissed";

interface Content {
  badge: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  dismiss: string;
}

const CONTENT: Record<Locale, Content> = {
  en: {
    badge: "Unlock full access",
    title: "Open My Infinox Account Now",
    body: "Full access to the IX Live Trading Room requires a verified live Infinox account with a minimum net balance of $100 USD.",
    primary: "Open My Infinox Account Now",
    secondary: "Connect My Existing MT5 Account",
    dismiss: "Dismiss",
  },
  es: {
    badge: "Desbloquea el acceso completo",
    title: "Abre mi cuenta Infinox ahora",
    body: "El acceso completo al IX Live Trading Room requiere una cuenta Infinox real verificada con un saldo neto mínimo de $100 USD.",
    primary: "Abrir mi cuenta Infinox ahora",
    secondary: "Conectar mi cuenta MT5 existente",
    dismiss: "Cerrar",
  },
  pt: {
    badge: "Desbloqueie o acesso completo",
    title: "Abra minha conta Infinox agora",
    body: "Acesso completo ao IX Live Trading Room requer uma conta Infinox real verificada com saldo líquido mínimo de $100 USD.",
    primary: "Abrir minha conta Infinox agora",
    secondary: "Conectar minha conta MT5 existente",
    dismiss: "Fechar",
  },
};

interface Props {
  show: boolean;
}

const OpenAccountBanner = ({ show }: Props) => {
  const { locale } = useLanguage();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  if (!show || dismissed) return null;

  const c = CONTENT[locale] ?? CONTENT.en;

  const handleDismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <section
      aria-labelledby="open-account-banner-title"
      className="relative overflow-hidden rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/[0.06] to-transparent p-5 shadow-[0_30px_120px_-40px_hsl(48_100%_51%/0.55)] backdrop-blur-xl sm:p-7"
    >
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[hsl(28_100%_55%/0.18)] blur-3xl"
        aria-hidden="true"
      />
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-secondary/60 hover:text-foreground"
        aria-label={c.dismiss}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3 w-3" />
            {c.badge}
          </span>
          <h2
            id="open-account-banner-title"
            className="mt-3 font-heading text-xl font-bold text-foreground sm:text-2xl"
          >
            {c.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {c.body}
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            asChild
            size="lg"
            className="cta-pulse group h-12 w-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.6),0_0_30px_hsl(45_100%_50%/0.5)] sm:w-auto"
          >
            <a
              href={INFINOX_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("open_infinox_account_click", { location: "dashboard_banner", locale })}
            >
              {c.primary}
              <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 w-full border-primary/50 bg-primary/[0.06] font-semibold text-primary backdrop-blur-md hover:bg-primary/15 sm:w-auto"
          >
            <Link to="/connect">
              {c.secondary}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default OpenAccountBanner;
