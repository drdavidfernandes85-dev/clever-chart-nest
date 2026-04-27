import { Sparkles } from "lucide-react";
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
      links: [t("footer.features"), t("footer.pricing"), t("footer.webinars"), t("footer.blog")],
    },
    {
      title: t("footer.resources"),
      links: [t("footer.trading"), t("footer.education"), t("footer.community"), t("footer.faq")],
    },
    {
      title: t("footer.support"),
      links: [t("footer.contactUs"), t("footer.privacy"), t("footer.terms"), t("footer.sitemap")],
    },
  ];

  return (
    <footer className="relative bg-background/95 backdrop-blur-xl border-t border-border py-16">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <a href="#home" className="flex items-center gap-3">
              <img src={infinoxLogo} alt="INFINOX" className="h-6" />
            </a>
            <span className="mt-3 inline-block font-heading text-sm font-semibold text-foreground">
              <span className="text-primary">IX</span> Live Trading Room
            </span>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t("footer.desc")}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 font-heading text-xs font-semibold text-foreground uppercase tracking-wider">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
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
