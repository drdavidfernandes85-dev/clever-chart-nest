import { AlertTriangle, ShieldCheck, BookOpen, Ban } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const ComplianceBlock = () => {
  const { t } = useLanguage();
  const items = [
    {
      icon: AlertTriangle,
      title: t("home.compliance.item.risk.title"),
      body: t("home.compliance.item.risk.body"),
    },
    {
      icon: Ban,
      title: t("home.compliance.item.noAdvice.title"),
      body: t("home.compliance.item.noAdvice.body"),
    },
    {
      icon: ShieldCheck,
      title: t("home.compliance.item.ideas.title"),
      body: t("home.compliance.item.ideas.body"),
    },
    {
      icon: BookOpen,
      title: t("home.compliance.item.platform.title"),
      body: t("home.compliance.item.platform.body"),
    },
  ];

  return (
    <section
      id="compliance"
      aria-labelledby="compliance-title"
      className="relative mx-auto w-full max-w-7xl px-4 py-16 scroll-mt-32 sm:px-6 lg:px-8"
    >
      <div className="rounded-3xl border border-primary/20 bg-card/40 p-6 backdrop-blur-2xl shadow-[0_30px_120px_-60px_hsl(45_100%_50%/0.35)] md:p-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {t("home.compliance.eyebrow")}
          </span>
          <h2
            id="compliance-title"
            className="mt-4 font-heading text-3xl md:text-4xl font-bold text-foreground"
          >
            {t("home.compliance.title")}
          </h2>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            {t("home.compliance.subtitle")}
          </p>
        </div>

        <ul
          role="list"
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {items.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-white/10 bg-background/40 p-5 transition-colors hover:border-primary/40"
            >
              <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-sm font-bold text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-4xl text-center text-[11px] leading-relaxed text-muted-foreground/80">
          {t("home.compliance.footer")}
        </p>
      </div>
    </section>
  );
};

export default ComplianceBlock;
