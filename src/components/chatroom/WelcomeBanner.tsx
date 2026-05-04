import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, X } from "lucide-react";
import type { Locale } from "@/i18n/translations";

interface WelcomeContent {
  greeting: string;
  body1: string;
  body2: string;
  disclaimer: string;
  intro: string;
  link: string;
  dismiss: string;
}

const CONTENT: Record<Locale, WelcomeContent> = {
  en: {
    greeting: "👋 Welcome to the IX Sala de Trading!",
    body1: "This is a professional educational community.",
    body2: "Please keep conversations respectful and focused on learning.",
    disclaimer: "All content is for educational purposes only.",
    intro: "",
    link: "Full guidelines",
    dismiss: "Dismiss",
  },
  es: {
    greeting: "👋 ¡Bienvenido al IX Sala de Trading!",
    body1: "Esta es una comunidad educativa profesional.",
    body2: "Mantén las conversaciones respetuosas y enfocadas en el aprendizaje.",
    disclaimer: "Todo el contenido es solo con fines educativos.",
    intro: "",
    link: "Normas completas",
    dismiss: "Cerrar",
  },
  pt: {
    greeting: "👋 Bem-vindo ao IX Sala de Trading!",
    body1: "Esta é uma comunidade educativa profissional.",
    body2: "Mantenha as conversas respeitosas e focadas em aprendizado.",
    disclaimer: "Todo o conteúdo é apenas para fins educacionais.",
    intro: "",
    link: "Regras completas",
    dismiss: "Fechar",
  },
};

const STORAGE_KEY = "ix.welcomeBanner.dismissed";

const WelcomeBanner = ({ locale, channelName }: { locale: Locale; channelName: string }) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${STORAGE_KEY}.${channelName}`) === "1";
  });

  if (dismissed) return null;

  const c = CONTENT[locale] ?? CONTENT.en;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${STORAGE_KEY}.${channelName}`, "1");
    }
    setDismissed(true);
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/70 to-background/40 p-4 shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.4)] backdrop-blur-md sm:p-5">
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl"
        aria-hidden="true"
      />
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-secondary/60 hover:text-foreground"
        aria-label={c.dismiss}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="relative">
        <p className="font-heading text-sm font-bold text-foreground sm:text-base">{c.greeting}</p>
        <p className="mt-2 text-xs text-foreground/85 sm:text-sm">{c.body1}</p>
        <p className="mt-2 text-xs text-foreground/85 sm:text-sm">{c.body2}</p>
        <p className="mt-2 text-[11px] italic text-muted-foreground sm:text-xs">{c.disclaimer}</p>
        <p className="mt-2 text-xs text-foreground/80 sm:text-sm">{c.intro}</p>
        <Link
          to="/community/guidelines"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary/20 hover:shadow-[0_4px_18px_-6px_hsl(48_100%_51%/0.6)] sm:text-xs"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {c.link} →
        </Link>
      </div>
    </div>
  );
};

export default WelcomeBanner;
