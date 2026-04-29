import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import infinoxLogoWhite from "@/assets/infinox-logo-white.png";
import infinoxLogoBlack from "@/assets/infinox-logo-black.svg";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

const Footer = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const infinoxLogo = theme === "dark" ? infinoxLogoWhite : infinoxLogoBlack;

  const columns = [
    {
      title: t("footer.quickLinks"),
      links: [
        { label: t("footer.anchor.dashboard"), to: "/dashboard" },
        { label: t("footer.anchor.community"), to: "/chatroom" },
        { label: t("footer.anchor.webinars"), to: "/webinars" },
        { label: t("footer.anchor.pricing"), to: "/#pricing" },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: t("footer.anchor.education"), to: "/education" },
        { label: t("footer.anchor.analysis"), to: "/signals" },
        { label: t("footer.anchor.risk"), to: "/dashboard" },
        { label: t("footer.anchor.connect"), to: "/connect-mt" },
      ],
    },
    {
      title: t("footer.support"),
      links: [
        { label: t("footer.anchor.faq"), to: "/#faq" },
        { label: t("footer.anchor.contact"), to: "/#contact" },
        { label: t("footer.privacy"), to: "/#" },
        { label: t("footer.terms"), to: "/#" },
      ],
    },
  ];

  return (
    <footer className="relative bg-background/95 backdrop-blur-xl border-t border-border py-16">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-3" aria-label="IX Live Trading Room — Home">
              <img src={infinoxLogo} alt="INFINOX — Online Trading Broker" className="h-6" />
            </Link>
            <span className="mt-3 inline-block font-heading text-sm font-semibold text-foreground">
              <span className="text-primary">IX</span> Live Trading Room
            </span>
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
            <span className="font-semibold text-foreground/70">Risk Disclaimer:</span> Trading involves significant risk of loss. Past performance is not indicative of future results. All content is for educational purposes only and does not constitute financial advice.
          </p>
          <p className="text-muted-foreground/60">
            IX Live Trading Room is an educational community. We do not provide signals or copy-trading services. Always trade responsibly.
          </p>
        </div>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} IX Live Trading Room — Powered by INFINOX. {t("footer.rights")}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> Version 1.0 · Launch Ready
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
