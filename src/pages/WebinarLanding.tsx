import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  GraduationCap,
  Languages,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import SEO from "@/components/SEO";
import KeywordCrossLinks from "@/components/seo/KeywordCrossLinks";
import WebinarRegistrationForm from "@/components/lead/WebinarRegistrationForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWebinars } from "@/hooks/useWebinars";
import { track } from "@/lib/analytics";
import ogWebinarImage from "@/assets/og-webinar.jpg";

const SITE_URL = "https://elitelivetradingroom.com";
const PAGE_URL = `${SITE_URL}/webinar`;
const INFINOX_SIGNUP =
  "https://myaccount.infinox.com/es/links/go/9926281";

/** Fallback target: next weekday at 14:00 UTC. */
const fallbackTarget = (): Date => {
  const target = new Date();
  target.setUTCHours(14, 0, 0, 0);
  if (target <= new Date()) target.setUTCDate(target.getUTCDate() + 1);
  while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
};

const useFullCountdown = (target: Date | null) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return { d: 0, h: 0, m: 0, s: 0, isLive: false };
  const diff = target.getTime() - now;
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, isLive: true };
  const total = Math.floor(diff / 1000);
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
    isLive: false,
  };
};

const FAQ_KEYS = [1, 2, 3, 4, 5] as const;
const BENEFITS = [1, 2, 3, 4] as const;
const LEARN = [1, 2, 3, 4] as const;
const TESTI = [1, 2, 3] as const;

const WebinarLanding = () => {
  const { t, locale } = useLanguage();

  // Try to use live DB schedule; fall back to deterministic next weekday.
  const { upcoming } = useWebinars(true);
  const target = useMemo(() => {
    if (upcoming?.scheduled_at) return new Date(upcoming.scheduled_at);
    return fallbackTarget();
  }, [upcoming]);
  const { d, h, m, s, isLive } = useFullCountdown(target);

  const sessionTitle = upcoming?.title || t("webinarLp.topic.fallback");
  const sessionDuration = upcoming?.duration_minutes ?? 60;
  const speakerName = upcoming?.host_name || t("webinarLp.speaker.name");
  const joinUrl = upcoming?.stream_url || PAGE_URL;

  const webinarContext = {
    webinarId: upcoming?.id ?? null,
    topic: sessionTitle,
    scheduledAt: target.toISOString(),
    durationMinutes: sessionDuration,
    hostName: speakerName,
    joinUrl,
  };

  const localeTag = locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";
  const dateString = useMemo(
    () =>
      target.toLocaleString(localeTag, {
        weekday: "long",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    [target, localeTag],
  );

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Event",
      name: sessionTitle,
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      startDate: target.toISOString(),
      endDate: new Date(target.getTime() + sessionDuration * 60_000).toISOString(),
      inLanguage: localeTag,
      location: {
        "@type": "VirtualLocation",
        url: PAGE_URL,
      },
      organizer: {
        "@type": "Organization",
        name: "IX Live Trading Room",
        url: SITE_URL,
      },
      performer: {
        "@type": "Person",
        name: speakerName,
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: PAGE_URL,
      },
      description: t("webinarLp.seo.desc"),
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_KEYS.map((n) => ({
        "@type": "Question",
        name: t(`webinarLp.faq.q${n}` as any),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(`webinarLp.faq.a${n}` as any),
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: t("webinarLp.eyebrow"), item: PAGE_URL },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "IX Live Trading Room",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.ico`,
      sameAs: ["https://www.infinox.com"],
    },
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: t("webinarLp.h1"),
      description: t("webinarLp.seo.desc"),
      provider: {
        "@type": "Organization",
        name: "IX Live Trading Room",
        sameAs: SITE_URL,
      },
      inLanguage: ["es", "pt-BR", "en"],
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        category: "Free",
      },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        startDate: target.toISOString(),
        inLanguage: localeTag,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: PAGE_URL,
      name: t("webinarLp.seo.title"),
      description: t("webinarLp.seo.desc"),
      inLanguage: localeTag,
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["h1", "h2"],
      },
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <SEO
        title={t("webinarLp.seo.title")}
        description={t("webinarLp.seo.desc")}
        keywords={t("webinarLp.seo.keywords" as any)}
        canonical={PAGE_URL}
        image={`${SITE_URL}${ogWebinarImage}`}
        imageAlt={t("webinarLp.share.imageAlt" as any)}
        shareTitle={t("webinarLp.share.title" as any)}
        shareDescription={t("webinarLp.share.desc" as any)}
        twitterCard="summary_large_image"
        jsonLd={jsonLd}
      />

      {/* Ambient fiery glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[700px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(45 100% 50% / 0.16) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 30%, hsl(28 100% 50% / 0.12) 0%, transparent 65%)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link
          to="/"
          className="font-heading text-base font-bold tracking-tight text-foreground hover:text-primary transition-colors"
        >
          IX <span className="text-primary">Live</span> Trading Room
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm" className="text-foreground/70 hover:text-primary">
            <Link to="/">{t("nav.home")}</Link>
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:pt-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {/* LEFT — copy + countdown + benefits */}
          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {t("webinarLp.eyebrow")}
            </div>

            <h1 className="font-heading text-4xl font-bold leading-[1.06] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              {t("webinarLp.h1")}
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-foreground/75 md:text-lg">
              {t("webinarLp.sub")}
            </p>

            {/* Countdown */}
            <div className="rounded-2xl border border-primary/30 bg-card/40 p-5 backdrop-blur-2xl shadow-[0_0_40px_hsl(45_100%_50%/0.18)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Clock className="h-3.5 w-3.5" />
                {isLive ? t("webinarLp.countdown.live") : t("webinarLp.countdown.label")}
              </div>
              {!isLive ? (
                <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { v: d, label: t("webinarLp.countdown.days") },
                    { v: h, label: t("webinarLp.countdown.hours") },
                    { v: m, label: t("webinarLp.countdown.minutes") },
                    { v: s, label: t("webinarLp.countdown.seconds") },
                  ].map((u, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-primary/20 bg-background/60 px-2 py-3 text-center"
                    >
                      <div className="font-mono text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                        {String(u.v).padStart(2, "0")}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-foreground/60">
                        {u.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-2xl font-bold text-primary">
                  🔴 LIVE
                </div>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-xs text-foreground/60">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateString}
              </p>
            </div>

            {/* Benefits */}
            <div>
              <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-primary">
                {t("webinarLp.benefits.title")}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {BENEFITS.map((n) => (
                  <li
                    key={n}
                    className="flex items-start gap-2 rounded-lg border border-white/5 bg-card/30 px-3 py-2.5 text-sm text-foreground/85 backdrop-blur-md"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t(`webinarLp.benefits.${n}` as any)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Secondary external CTA */}
            <Button
              asChild
              variant="outline"
              className="h-12 w-fit gap-2 rounded-full border-primary/50 bg-primary/5 px-6 text-sm font-bold text-primary hover:bg-primary/15 hover:border-primary"
            >
              <a
                href={INFINOX_SIGNUP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track("open_infinox_account_click", {
                    location: "webinar_lp_hero_secondary",
                    locale,
                  })
                }
              >
                {t("webinarLp.form.openAccount")}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>

          {/* RIGHT — registration form card */}
          <div className="relative">
            <div className="sticky top-6 rounded-3xl border-2 border-primary/40 bg-card/60 p-6 backdrop-blur-2xl shadow-[0_0_60px_hsl(45_100%_50%/0.25)] sm:p-8">
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t("webinarLp.form.title")}
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                {t("webinarLp.form.title")}
              </h2>
              <p className="mt-2 text-sm text-foreground/70">
                {t("webinarLp.form.subtitle")}
              </p>

              <div className="mt-5">
                <WebinarRegistrationForm source="webinar_lp_hero" webinar={webinarContext} />
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/5 bg-background/40 px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-[11px] leading-relaxed text-foreground/65">
                  {t("webinarLp.disclaimer")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOPIC + WHAT YOU'LL LEARN */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Topic / date card */}
          <div className="rounded-3xl border border-primary/25 bg-card/40 p-7 backdrop-blur-2xl">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("webinarLp.topic.title")}
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
              {sessionTitle}
            </h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/5 bg-background/40 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-foreground/55">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  {t("webinarLp.topic.dateLabel")}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">{dateString}</dd>
              </div>
              <div className="rounded-xl border border-white/5 bg-background/40 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-foreground/55">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {t("webinarLp.topic.durationLabel")}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">{sessionDuration} min</dd>
              </div>
              <div className="rounded-xl border border-white/5 bg-background/40 p-3 sm:col-span-2">
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-foreground/55">
                  <Languages className="h-3.5 w-3.5 text-primary" />
                  {t("webinarLp.topic.langLabel")}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {t("webinarLp.topic.lang")}
                </dd>
              </div>
            </dl>
          </div>

          {/* Learn list */}
          <div className="rounded-3xl border border-primary/25 bg-card/40 p-7 backdrop-blur-2xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <GraduationCap className="h-3.5 w-3.5" />
              {t("webinarLp.learn.title")}
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
              {t("webinarLp.learn.title")}
            </h2>
            <ul className="mt-5 space-y-3">
              {LEARN.map((n) => (
                <li
                  key={n}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-background/40 px-4 py-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-xs font-bold text-primary">
                    {n}
                  </span>
                  <span className="text-sm leading-relaxed text-foreground/85">
                    {t(`webinarLp.learn.${n}` as any)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* SPEAKER */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card/40 to-transparent p-7 backdrop-blur-2xl sm:p-10">
          <div className="grid items-center gap-7 sm:grid-cols-[auto_1fr]">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-primary/40 bg-primary/10 text-primary shadow-[0_0_40px_hsl(45_100%_50%/0.3)]">
              <UserCircle2 className="h-14 w-14" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {t("webinarLp.speaker.title")}
              </div>
              <h2 className="mt-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">
                {t("webinarLp.speaker.name")}
              </h2>
              <p className="mt-1 text-sm font-semibold text-foreground/70">
                {t("webinarLp.speaker.role")}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75">
                {t("webinarLp.speaker.bio")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 text-center font-heading text-3xl font-bold text-foreground sm:text-4xl">
          {t("webinarLp.testimonials.title")}
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {TESTI.map((n) => (
            <figure
              key={n}
              className="rounded-2xl border border-white/8 bg-card/40 p-6 backdrop-blur-2xl transition-all hover:border-primary/40 hover:shadow-[0_0_30px_hsl(45_100%_50%/0.15)]"
            >
              <div className="mb-3 flex gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed text-foreground/85">
                “{t(`webinarLp.testimonials.${n}.quote` as any)}”
              </blockquote>
              <figcaption className="mt-4 border-t border-white/5 pt-3">
                <div className="text-sm font-semibold text-foreground">
                  {t(`webinarLp.testimonials.${n}.name` as any)}
                </div>
                <div className="text-xs text-foreground/55">
                  {t(`webinarLp.testimonials.${n}.role` as any)}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 text-center font-heading text-3xl font-bold text-foreground sm:text-4xl">
          {t("webinarLp.faq.title")}
        </h2>
        <Accordion type="single" collapsible className="space-y-3">
          {FAQ_KEYS.map((n) => (
            <AccordionItem
              key={n}
              value={`faq-${n}`}
              className="rounded-xl border border-white/8 bg-card/40 px-5 backdrop-blur-2xl"
            >
              <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:text-primary">
                {t(`webinarLp.faq.q${n}` as any)}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-foreground/75">
                {t(`webinarLp.faq.a${n}` as any)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/[0.12] via-card/50 to-transparent p-8 text-center backdrop-blur-2xl shadow-[0_0_60px_hsl(45_100%_50%/0.2)] sm:p-12">
          <Globe className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            {t("webinarLp.h1")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-foreground/75 sm:text-base">
            {t("webinarLp.form.subtitle")}
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <WebinarRegistrationForm source="webinar_lp_footer" webinar={webinarContext} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              variant="outline"
              className="h-11 gap-2 rounded-full border-primary/50 bg-primary/5 px-6 text-sm font-bold text-primary hover:bg-primary/15"
            >
              <a
                href={INFINOX_SIGNUP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track("open_infinox_account_click", {
                    location: "webinar_lp_footer",
                    locale,
                  })
                }
              >
                {t("webinarLp.form.openAccount")}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-11 rounded-full px-5 text-sm text-foreground/70 hover:text-primary"
            >
              <Link to="/connect">
                <PlayCircle className="h-4 w-4" />
                {t("hero.cta.connectExisting")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* SEO internal links */}
      <KeywordCrossLinks current="webinars" />

      {/* Footer disclaimer */}
      <footer className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-center text-[11px] leading-relaxed text-foreground/45">
          {t("webinarLp.disclaimer")}
        </p>
      </footer>
    </div>
  );
};

export default WebinarLanding;
