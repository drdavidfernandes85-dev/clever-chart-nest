import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import infinoxLogoWhite from "@/assets/infinox-logo-white.png";
import infinoxLogoBlack from "@/assets/infinox-logo-black.svg";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";

const Footer = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const infinoxLogo = theme === "dark" ? infinoxLogoWhite : infinoxLogoBlack;

  const columns = [
    {
      title: t("footer.quickLinks"),
      links: [
        { label: t("footer.anchor.education"), to: "/education" },
        { label: t("footer.anchor.webinars"), to: "/webinars" },
        { label: "Video Library", to: "/videos" },
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
        { label: "Community Guidelines", to: "/community/guidelines" },
        { label: t("footer.anchor.contact"), to: "/#contact" },
      ],
    },
  ];

  return (
    <footer className="relative bg-background/95 backdrop-blur-xl border-t border-border py-16">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="inline-flex items-center" aria-label="LTR Terminal Pro — Home">
              <LtrLogo variant="full" className="text-sm" />
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
            <span className="font-semibold text-foreground/70">Risk warning:</span> Trading leveraged products involves significant risk and may not be suitable for all investors. You may lose more than your initial investment. The content in this trading room is provided for educational and informational purposes only and does not constitute investment advice, financial advice, or a recommendation to buy or sell any financial instrument. Users are solely responsible for their trading decisions.
          </p>
          <p className="text-muted-foreground/60">
            Trading Layer is an independent third-party technology provider. The broker is not the provider of trade ideas, copy / follow functionality, or third-party trading technology. The broker's role is limited to the provision of the trading account and execution venue, subject to its own terms and regulatory permissions.
          </p>
        </div>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} IX Sala de Trading. {t("footer.rights")}
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
