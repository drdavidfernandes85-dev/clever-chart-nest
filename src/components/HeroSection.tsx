import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroComet from "@/assets/hero-comet.jpg";
import { getNextWebinarDate, useCountdown } from "@/hooks/useWebinarCountdown";
import { useLanguage } from "@/i18n/LanguageContext";

// Webinar hour (LATAM, UTC-3). Keep as constants — not user-visible copy.
const WEBINAR_HOUR_LOCAL = 20;
const WEBINAR_OFFSET_UTC = -3;

// Faint noise texture (SVG data URI). Adds organic depth over the background
// without shipping an extra asset request. ~very low opacity, blend "overlay".
const NOISE_DATA_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>\")";

const HeroSection = () => {
  const { t } = useLanguage();

  const target = useMemo(
    () => getNextWebinarDate(WEBINAR_HOUR_LOCAL, WEBINAR_OFFSET_UTC),
    [],
  );
  const { h, m, s, isLive } = useCountdown(target);

  return (
    <section
      id="home"
      className="relative isolate mx-auto w-full max-w-[1400px] overflow-hidden pt-16 bg-background"
    >
      {/* ───────── Background stack (kept image, added depth) ───────── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Base radial wash */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 95% 75% at 70% 50%, hsl(28 85% 9% / 0.7) 0%, hsl(0 0% 2%) 70%)",
          }}
        />
        {/* Existing comet image — responsive sizing, slightly damped on mobile */}
        <img
          src={heroComet}
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority="high"
          className="absolute inset-y-0 right-0 h-full w-full sm:w-[88%] lg:w-[82%] object-cover sm:object-contain object-right select-none opacity-60 sm:opacity-80 lg:opacity-100"
          style={{
            filter: "saturate(1.15) contrast(1.08)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
          }}
          draggable={false}
        />
        {/* Refined dark gradient for headline contrast (WCAG AA) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.88) 28%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.25) 78%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {/* Subtle vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 110% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {/* Very light film grain */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{ backgroundImage: NOISE_DATA_URI, backgroundSize: "160px 160px" }}
        />
      </div>

      {/* ───────── Hero content ───────── */}
      <div className="container relative z-10 py-10 sm:py-16 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          {/* LEFT — copy */}
          <div className="flex flex-col items-start gap-5 sm:gap-6 text-left">
            {/* Live pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCD05]/40 bg-[#FFCD05]/10 px-3 py-1.5 backdrop-blur-md shadow-[0_0_25px_hsl(45_100%_50%/0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFCD05] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFCD05]" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white">
                {t("hero.v2.badge")}
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-heading font-bold leading-[1.05] tracking-tight text-white text-[34px] sm:text-5xl md:text-6xl lg:text-[64px]">
              <span className="block drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
                {t("hero.v2.headline1")}
              </span>
              <span className="mt-1 block bg-gradient-to-r from-[#FFCD05] via-[#FFE066] to-[#f5a623] bg-clip-text text-transparent drop-shadow-[0_0_40px_hsl(45_100%_50%/0.5)]">
                {t("hero.v2.headline2")}
              </span>
            </h1>

            {/* Subhead — white/90 ensures WCAG AA over darkened bg */}
            <p className="max-w-xl text-base md:text-lg leading-relaxed font-sans text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
              {t("hero.v2.subhead")}
            </p>

            {/* CTAs — one primary + one secondary text link */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
              <Button
                asChild
                size="lg"
                className="h-12 md:h-14 gap-2 rounded-full px-6 sm:px-8 text-sm md:text-base font-bold bg-[#FFCD05] text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.5),0_0_30px_hsl(45_100%_50%/0.45)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.8)] transition-shadow"
              >
                <Link to="/register">
                  {t("hero.v2.primaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <a
                href="#como-funciona"
                className="text-sm md:text-base font-semibold text-white/85 underline-offset-4 hover:text-[#FFCD05] hover:underline transition-colors"
              >
                {t("hero.v2.secondaryCta")} →
              </a>
            </div>

            {/* Trust / stats bar — understated, below CTA */}
            <ul className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] sm:text-xs uppercase tracking-wider text-white/55">
              <li className="font-semibold text-white/80">INFINOX</li>
              <li aria-hidden className="text-white/25">·</li>
              <li>{t("hero.v2.stats.traders")}</li>
              <li aria-hidden className="text-white/25">·</li>
              <li>{t("hero.v2.stats.price")}</li>
              <li aria-hidden className="text-white/25">·</li>
              <li>{t("hero.v2.stats.cadence")}</li>
            </ul>
          </div>

          {/* RIGHT — Live webinar countdown card (replaces portrait slot) */}
          <aside
            aria-label={t("hero.v2.countdown.label")}
            className="relative w-full max-w-md justify-self-start lg:justify-self-end rounded-2xl border border-[#FFCD05]/25 bg-black/55 p-5 sm:p-6 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_60px_-20px_rgba(255,205,5,0.35)]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FFCD05]/15 text-[#FFCD05]">
                <Radio className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05]">
                  {t("hero.v2.countdown.label")}
                </p>
                <p className="text-sm text-white/80">{t("hero.v2.countdown.timeLabel")}</p>
              </div>
            </div>

            <div className="mt-5">
              {isLive ? (
                <div className="text-3xl font-mono font-bold uppercase tracking-wider text-[#FFCD05] animate-pulse">
                  {t("hero.v2.countdown.liveNow")}
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <span className="text-xs uppercase tracking-wider text-white/50">
                    {t("hero.v2.countdown.inPrefix")}
                  </span>
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-white tabular-nums">
                    {String(h).padStart(2, "0")}
                    <span className="text-white/40">:</span>
                    {String(m).padStart(2, "0")}
                    <span className="text-white/40">:</span>
                    {String(s).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>

            <Button
              asChild
              className="mt-5 h-11 w-full gap-2 rounded-full bg-[#FFCD05]/10 border border-[#FFCD05]/40 text-sm font-bold text-[#FFCD05] hover:bg-[#FFCD05] hover:text-black transition-colors"
            >
              <Link to="/webinars">
                <CalendarClock className="h-4 w-4" />
                {t("hero.v2.countdown.reserve")}
              </Link>
            </Button>
          </aside>
        </div>
      </div>

      {/* Slim partner / data note bar — understated, single row */}
      <div className="relative z-10 border-y border-white/5 bg-black/40">
        <div className="container flex items-center gap-4 overflow-x-auto px-4 py-2.5 scrollbar-hide">
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-white/30">
            {t("hero.v2.trust.partners")}
          </span>
          <span className="shrink-0 text-white/10" aria-hidden>|</span>
          <a
            href="https://www.infinox.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-white/30 transition-colors hover:text-[#FFCD05]/70"
          >
            INFINOX
          </a>
          <span className="shrink-0 text-white/10" aria-hidden>|</span>
          <span className="shrink-0 text-[11px] text-white/25">
            {t("hero.v2.trust.dataNote")}
          </span>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
};

export default HeroSection;
