import { Link } from "react-router-dom";
import { Sparkles, ExternalLink, PlayCircle, Link2, ShieldCheck, ArrowRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadCaptureForm from "@/components/lead/LeadCaptureForm";
import SEO from "@/components/SEO";
import { useLanguage } from "@/i18n/LanguageContext";
import { track } from "@/lib/analytics";

interface Props {
  reason?:
    | "no_account"
    | "not_live"
    | "low_balance"
    | "not_verified"
    | "unknown";
  balance?: number | null;
  currency?: string | null;
}

const DEPOSIT_URL = "https://myaccount.infinox.com/es/links/go/9926281";

const AccessDeniedScreen = ({ reason = "unknown", balance, currency }: Props) => {
  const { t, locale } = useLanguage();

  const reasonKey =
    `access.reason.${reason}` as
      | "access.reason.no_account"
      | "access.reason.not_live"
      | "access.reason.not_verified"
      | "access.reason.low_balance"
      | "access.reason.unknown";

  const canonical = typeof window !== "undefined" ? window.location.href : undefined;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background">
      <SEO
        title={t("access.seo.title")}
        description={t("access.seo.desc")}
        keywords={t("access.seo.keywords")}
        canonical={canonical}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: t("access.seo.title"),
          description: t("access.seo.desc"),
          url: canonical,
          inLanguage: locale === "pt" ? "pt-BR" : locale,
        }}
      />

      {/* Ambient fiery glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[hsl(45_100%_50%/0.14)] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-[hsl(20_90%_50%/0.12)] blur-[120px]" />
        <div className="absolute top-1/3 -left-20 h-[320px] w-[320px] rounded-full bg-[hsl(45_100%_50%/0.08)] blur-[100px]" />
      </div>

      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-5 py-14 text-center sm:px-6 sm:py-20">
        <article className="relative w-full overflow-hidden rounded-3xl border border-primary/30 bg-card/40 p-7 shadow-[0_30px_120px_-30px_hsl(45_100%_50%/0.55)] backdrop-blur-2xl sm:p-12">
          {/* Inner highlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[hsl(28_100%_55%/0.18)] blur-3xl"
          />

          <div className="relative">
            {/* Friendly badge instead of lock */}
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t("access.h1.eyebrow" as any) || "Almost there"}
            </div>

            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t("access.h1")}
            </h1>

            {/* Clear, short eligibility statement */}
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-foreground/85 sm:text-base">
              {t("access.eligibility.short" as any)}
            </p>

            {/* Contextual reason — softer, non-restrictive tone */}
            <div className="mx-auto mt-5 max-w-lg rounded-2xl border border-primary/20 bg-background/40 p-4 text-left text-sm text-muted-foreground backdrop-blur-md">
              {t(reasonKey)}
              {reason === "low_balance" && balance != null && (
                <div className="mt-2 text-xs text-foreground/75">
                  {t("access.balance.current")}:{" "}
                  <span className="font-semibold text-foreground">
                    {balance.toFixed(2)} {currency ?? "USD"}
                  </span>{" "}
                  · {t("access.balance.required")}:{" "}
                  <span className="font-semibold text-foreground">100.00 USD</span>
                </div>
              )}
            </div>

            {/* Primary + secondary CTAs */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="cta-pulse group h-14 w-full gap-2 rounded-full bg-[#FFCD05] px-8 font-bold text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.6),0_0_30px_hsl(45_100%_50%/0.55),0_0_70px_hsl(28_100%_55%/0.4)] sm:w-auto"
              >
                <a
                  href={DEPOSIT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    track("open_infinox_account_click", { location: "access_denied", reason, locale });
                    track("deposit_click", { reason, locale });
                  }}
                >
                  {t("access.cta.deposit")}
                  <ExternalLink className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 w-full gap-2 rounded-full border-primary/40 bg-primary/[0.06] px-7 font-semibold text-primary backdrop-blur-md hover:bg-primary/15 hover:border-primary/70 sm:w-auto"
              >
                <Link
                  to="/webinars"
                  onClick={() => track("cta_click", { location: "access_denied_secondary_webinars", locale })}
                >
                  <PlayCircle className="h-4 w-4" />
                  {t("access.cta.webinars")}
                </Link>
              </Button>
            </div>

            {/* Reassuring "already have an account" */}
            <div className="mt-5">
              <Link
                to="/connect"
                onClick={() => track("connect_mt_click", { location: "access_denied_already_have", locale })}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-background/40 px-4 py-2 text-xs font-medium text-foreground/80 backdrop-blur-md transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary sm:text-sm"
              >
                <Link2 className="h-3.5 w-3.5 text-primary" />
                {t("access.cta.alreadyHave" as any)}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Trust line */}
            <p className="mx-auto mt-6 inline-flex max-w-md items-center justify-center gap-1.5 text-[11px] text-foreground/60">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
              {t("hero.eligibility")}
            </p>

            {/* Email capture — get notified + free webinar invites */}
            <section className="mx-auto mt-10 max-w-md rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 text-left backdrop-blur-md">
              <div className="mb-2 flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  {t("access.notify.title")}
                </h2>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("access.notify.desc")}
              </p>
              <LeadCaptureForm
                source="access_denied"
                ctaLabel={t("access.notify.button")}
                compact
              />
            </section>

            {/* Full disclaimer */}
            <p className="mx-auto mt-10 max-w-2xl text-[11px] leading-relaxed text-muted-foreground/80">
              {t("access.disclaimer")}
            </p>
          </div>
        </article>
      </main>
    </div>
  );
};

export default AccessDeniedScreen;
