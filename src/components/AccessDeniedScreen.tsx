import { Link } from "react-router-dom";
import { Lock, ExternalLink, PlayCircle, Link2, Bell } from "lucide-react";
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
  const { t } = useLanguage();

  const reasonKey =
    `access.reason.${reason}` as
      | "access.reason.no_account"
      | "access.reason.not_live"
      | "access.reason.not_verified"
      | "access.reason.low_balance"
      | "access.reason.unknown";

  const canonical = typeof window !== "undefined" ? window.location.href : undefined;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
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
        }}
      />

      {/* Ambient fiery glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[hsl(45,100%,50%)]/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[hsl(20,90%,50%)]/10 blur-[100px]" />
      </div>

      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <article className="relative w-full rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_120px_-40px_hsl(45,100%,50%,0.35)] backdrop-blur-xl sm:p-12">
          <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(45,100%,50%)]/30 bg-[hsl(45,100%,50%)]/10 text-[hsl(45,100%,55%)]">
            <Lock className="h-6 w-6" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("access.h1")}
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("access.intro")}
          </p>

          <div className="mx-auto mt-5 max-w-lg rounded-xl border border-white/10 bg-background/40 p-4 text-left text-sm text-muted-foreground">
            {t(reasonKey)}
            {reason === "low_balance" && balance != null && (
              <div className="mt-2 text-xs text-foreground/70">
                {t("access.balance.current")}:{" "}
                <span className="font-semibold text-foreground">
                  {balance.toFixed(2)} {currency ?? "USD"}
                </span>{" "}
                · {t("access.balance.required")}:{" "}
                <span className="font-semibold text-foreground">100.00 USD</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group relative w-full overflow-hidden bg-[hsl(45,100%,50%)] font-semibold text-black hover:bg-[hsl(45,100%,55%)] cta-pulse sm:w-auto"
            >
              <a
                href={DEPOSIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("deposit_click", { reason })}
              >
                {t("access.cta.deposit")}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-white/15 bg-white/[0.02] backdrop-blur-md hover:bg-white/[0.06] sm:w-auto"
            >
              <Link to="/webinars">
                <PlayCircle className="mr-2 h-4 w-4" />
                {t("access.cta.webinars")}
              </Link>
            </Button>
          </div>

          {reason === "no_account" && (
            <div className="mt-4">
              <Link
                to="/connect-mt"
                className="inline-flex items-center gap-1.5 text-xs text-[hsl(45,100%,55%)] hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" />
                {t("access.cta.connect")}
              </Link>
            </div>
          )}

          {/* Email capture — get notified + free webinar invites */}
          <section className="mx-auto mt-8 max-w-md rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 text-left backdrop-blur-md">
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

          <p className="mx-auto mt-8 max-w-lg text-[11px] leading-relaxed text-muted-foreground/80">
            {t("access.disclaimer")}
          </p>
        </article>
      </main>
    </div>
  );
};

export default AccessDeniedScreen;
