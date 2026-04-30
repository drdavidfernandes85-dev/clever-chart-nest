import { Link } from "react-router-dom";
import {
  Plug,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  CheckCircle2,
  Sparkles,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { useLanguage } from "@/i18n/LanguageContext";
import { track } from "@/lib/analytics";

const ConnectMyMT5 = () => {
  const { t } = useLanguage();
  const canonical =
    typeof window !== "undefined"
      ? window.location.origin + "/connect"
      : "https://elitelivetradingroom.com/connect";

  const steps = [1, 2, 3, 4] as const;
  const benefits = [1, 2, 3, 4] as const;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <SEO
        title={t("connectMt5.seo.title")}
        description={t("connectMt5.seo.desc")}
        keywords={t("connectMt5.seo.keywords")}
        canonical={canonical}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: t("connectMt5.h1"),
          description: t("connectMt5.intro"),
          step: steps.map((n) => ({
            "@type": "HowToStep",
            position: n,
            name: t(`connectMt5.steps.${n}.title` as any),
            text: t(`connectMt5.steps.${n}.desc` as any),
          })),
        }}
      />

      {/* Ambient fiery glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[hsl(45,100%,50%)]/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-[hsl(20,90%,50%)]/10 blur-[100px]" />
      </div>

      <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-6 py-14 sm:py-20">
        {/* Hero */}
        <section className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(45,100%,50%)]/30 bg-[hsl(45,100%,50%)]/10 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-[hsl(45,100%,60%)]">
            <Sparkles className="h-3 w-3" />
            {t("connectMt5.eyebrow")}
          </span>
          <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("connectMt5.h1")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("connectMt5.intro")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="cta-pulse group w-full bg-[hsl(45,100%,50%)] font-semibold text-black hover:bg-[hsl(45,100%,55%)] sm:w-auto"
            >
              <Link
                to="/connect-mt"
                onClick={() => track("connect_mt_click", { location: "connect_landing_hero" })}
              >
                <Plug className="mr-2 h-4 w-4" />
                {t("connectMt5.cta.primary")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-white/15 bg-white/[0.02] backdrop-blur-md hover:bg-white/[0.06] sm:w-auto"
            >
              <Link to="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                {t("connectMt5.cta.dashboard")}
              </Link>
            </Button>
          </div>
        </section>

        {/* New users — Open Infinox account */}
        <section className="mt-12 rounded-3xl border-2 border-[hsl(45,100%,50%)]/40 bg-gradient-to-br from-[hsl(45,100%,50%)]/[0.08] via-[hsl(45,100%,50%)]/[0.04] to-transparent p-6 backdrop-blur-xl shadow-[0_0_40px_hsl(45,100%,50%/0.15)] sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(45,100%,50%)]/40 bg-[hsl(45,100%,50%)]/15 text-[hsl(45,100%,60%)]">
                <UserPlus className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                {t("connectMt5.newUser.headline")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("connectMt5.newUser.subtitle")}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="cta-pulse group w-full shrink-0 bg-[hsl(45,100%,50%)] font-bold text-black hover:bg-[hsl(45,100%,55%)] sm:w-auto"
            >
              <a
                href="https://myaccount.infinox.com/es/links/go/9926281"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("open_infinox_account_click", { location: "connect_landing_new_user" })}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {t("connectMt5.newUser.cta")}
                <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </Button>
          </div>
          <p className="mt-5 rounded-xl border border-[hsl(45,100%,50%)]/20 bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            💡 {t("connectMt5.newUser.note")}
          </p>
        </section>

        {/* Steps — existing account */}
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-10">
          <div className="mb-6">
            <h2 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
              {t("connectMt5.existing.title")}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("connectMt5.existing.subtitle")}
            </p>
          </div>
          <h3 className="sr-only">{t("connectMt5.steps.title")}</h3>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2">
            {steps.map((n) => (
              <li
                key={n}
                className="relative rounded-2xl border border-white/10 bg-background/40 p-5"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[hsl(45,100%,50%)]/30 bg-[hsl(45,100%,50%)]/10 font-mono text-sm font-bold text-[hsl(45,100%,60%)]">
                  {n}
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t(`connectMt5.steps.${n}.title` as any)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`connectMt5.steps.${n}.desc` as any)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Benefits + Security */}
        <section className="mt-10 grid gap-5 sm:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t("connectMt5.benefits.title")}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {benefits.map((n) => (
                <li key={n} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(45,100%,55%)]" />
                  <span>{t(`connectMt5.benefits.${n}` as any)}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-[hsl(45,100%,50%)]/25 bg-[hsl(45,100%,50%)]/[0.04] p-6 backdrop-blur-xl">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(45,100%,50%)]/30 bg-[hsl(45,100%,50%)]/10 text-[hsl(45,100%,60%)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t("connectMt5.security.title")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("connectMt5.security.desc")}
            </p>
          </article>
        </section>

        {/* Final CTA */}
        <section className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="cta-pulse w-full bg-[hsl(45,100%,50%)] font-semibold text-black hover:bg-[hsl(45,100%,55%)] sm:w-auto"
          >
            <Link
              to="/connect-mt"
              onClick={() => track("connect_mt_click", { location: "connect_landing_footer" })}
            >
              <Plug className="mr-2 h-4 w-4" />
              {t("connectMt5.cta.primary")}
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground sm:w-auto"
          >
            <Link to="/dashboard">{t("connectMt5.cta.dashboard")}</Link>
          </Button>
        </section>

        <p className="mx-auto mt-12 max-w-2xl text-center text-[11px] leading-relaxed text-muted-foreground/80">
          {t("connectMt5.disclaimer")}
        </p>
      </main>
    </div>
  );
};

export default ConnectMyMT5;
