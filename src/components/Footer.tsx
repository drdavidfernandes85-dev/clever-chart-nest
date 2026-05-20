import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";
import LtrLogo from "@/components/branding/LtrLogo";

const Footer = () => {
  const { t } = useLanguage();

  // NOTE: /videos and /leaderboard intentionally removed from launch footer.
  // Routes remain accessible via direct URL for internal testing.
  const columns = [
    {
      title: t("footer.quickLinks"),
      links: [
        { label: t("footer.link.education"), to: "/education" },
        { label: t("footer.link.webinars"), to: "/webinars" },
        { label: t("footer.link.community"), to: "/chatroom" },
        { label: t("footer.link.terminal"), to: "/dashboard" },
        { label: t("footer.link.ideas"), to: "/ideas" },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: t("footer.link.nextWebinar"), to: "/webinar" },
        { label: t("footer.anchor.community"), to: "/community/guidelines" },
        { label: t("footer.anchor.pricing"), to: "/#pricing" },
        { label: t("footer.anchor.faq"), to: "/#faq" },
      ],
    },
    {
      title: t("footer.col.legal"),
      links: [
        { label: t("footer.link.terms"), to: "/terms" },
        { label: t("footer.link.risk"), to: "/risk-disclosure" },
        { label: t("footer.link.privacy"), to: "/terms#privacy" },
        { label: t("footer.link.guidelines"), to: "/community/guidelines" },
        { label: t("footer.link.compliance"), to: "/#contact" },
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
            <span className="font-semibold text-foreground/70">{t("footer.risk.label")}</span> {t("footer.risk.body")}
          </p>
          <p className="text-muted-foreground/60">
            {t("footer.tech.body")}
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
