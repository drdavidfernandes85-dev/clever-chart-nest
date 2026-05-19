import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import infinoxLogoWhite from "@/assets/infinox-logo-white.png";
import infinoxLogoBlack from "@/assets/infinox-logo-black.svg";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";
import LtrLogo from "@/components/branding/LtrLogo";

const Footer = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const infinoxLogo = theme === "dark" ? infinoxLogoWhite : infinoxLogoBlack;

  const columns = [
    {
      title: t("footer.quickLinks"),
      links: [
        { label: "Educación de Trading", to: "/education" },
        { label: "Webinars Gratuitos", to: "/webinars" },
        { label: "Biblioteca de Videos", to: "/videos" },
        { label: "Comunidad", to: "/chatroom" },
        { label: "LTR Terminal Pro", to: "/dashboard" },
        { label: "Ideas de Mercado", to: "/ideas" },
        { label: "Leaderboard", to: "/leaderboard" },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: "Próximo Webinar", to: "/webinar" },
        { label: t("footer.anchor.community"), to: "/community/guidelines" },
        { label: t("footer.anchor.pricing"), to: "/#pricing" },
        { label: t("footer.anchor.faq"), to: "/#faq" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms & Conditions", to: "/terms" },
        { label: "Risk Disclosure", to: "/risk-disclosure" },
        { label: "Privacy Notice", to: "/terms#privacy" },
        { label: "Community Guidelines", to: "/community/guidelines" },
        { label: "Contact Compliance", to: "/#contact" },
      ],
    },
  ];


  return (
    <footer className="relative bg-background/95 backdrop-blur-xl border-t border-border py-16">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="inline-flex items-center" aria-label="IX LTR PRO — Home">
              <LtrLogo variant="platform" className="h-10 w-auto" />
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t("footer.desc")}
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="mb-4 font-heading text-xs font-semibold text-foreground uppercase tracking-wider">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      title={link.label}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 cyber-line" />
        <div className="mt-6 mx-auto max-w-4xl space-y-2 text-center text-[11px] leading-relaxed text-muted-foreground/80">
          <p>
            <span className="font-semibold text-foreground/70">Aviso de riesgo:</span> Operar productos apalancados conlleva un riesgo significativo y puede no ser adecuado para todos los inversores. Puede perder más que su inversión inicial. El contenido de IX LTR (incluyendo LTR Terminal Pro, webinars, chatroom e Ideas de Mercado) es exclusivamente educativo e informativo y no constituye asesoría financiera, recomendaciones de inversión ni señales de trading. Cada usuario es responsable de sus propias decisiones.
          </p>
          <p className="text-muted-foreground/60">
            Trading Layer es un proveedor tecnológico independiente. El bróker no es el proveedor de ideas de mercado, herramientas de seguimiento ni tecnología de terceros. El rol del bróker se limita a la provisión de la cuenta de trading y venue de ejecución, sujeto a sus propios términos y permisos regulatorios.
          </p>
        </div>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} IX LTR. {t("footer.rights")}
          </div>
          <PoweredByTradingLayer />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> Version 1.0 · Launch Ready
          </span>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
