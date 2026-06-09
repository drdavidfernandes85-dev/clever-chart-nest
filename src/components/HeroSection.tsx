import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroComet from "@/assets/hero-comet.jpg";
import { getNextWebinarDate, useCountdown } from "@/hooks/useWebinarCountdown";

const HeroSection = () => {
  const target = useMemo(
    () =>
      getNextWebinarDate(
        HERO_CONTENT.countdown.hourLocal24,
        HERO_CONTENT.countdown.timezoneOffsetFromUTC,
      ),
    [],
  );
  const { h, m, s, isLive } = useCountdown(target);

  return (
    <section
      id="home"
      className="relative isolate mx-auto w-full max-w-[1400px] overflow-hidden pt-16 bg-background"
    >
      {/* Background image + radial wash */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 95% 75% at 70% 50%, hsl(28 85% 9% / 0.7) 0%, hsl(0 0% 2%) 70%)",
          }}
        />
        <img
          src={heroComet}
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority="high"
          className="absolute inset-y-0 right-0 h-full w-[82%] object-contain object-right select-none opacity-80 lg:opacity-100"
          style={{
            filter: "saturate(1.15) contrast(1.08)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
          }}
          draggable={false}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.85) 24%, rgba(0,0,0,0.40) 50%, rgba(0,0,0,0) 74%)",
          }}
        />
      </div>

      {/* Hero content */}
      <div className="container relative z-10 py-12 sm:py-16 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — copy */}
          <div className="flex flex-col items-start gap-6 text-left">
            {/* Live pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCD05]/40 bg-[#FFCD05]/10 px-3 py-1.5 backdrop-blur-md shadow-[0_0_25px_hsl(45_100%_50%/0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFCD05] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFCD05]" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white">
                {HERO_CONTENT.badge}
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-heading font-bold leading-[1.05] tracking-tight text-white text-4xl sm:text-5xl md:text-6xl lg:text-[64px]">
              <span className="block drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
                {HERO_CONTENT.headlineLine1}
              </span>
              <span className="mt-1 block bg-gradient-to-r from-[#FFCD05] via-[#FFE066] to-[#f5a623] bg-clip-text text-transparent drop-shadow-[0_0_40px_hsl(45_100%_50%/0.5)]">
                {HERO_CONTENT.headlineLine2}
              </span>
            </h1>

            {/* Subhead */}
            <p className="max-w-xl text-base md:text-lg leading-relaxed font-sans text-white/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {HERO_CONTENT.subhead}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
              <Button
                asChild
                size="lg"
                className="h-12 md:h-14 gap-2 rounded-full px-6 sm:px-8 text-sm md:text-base font-bold bg-[#FFCD05] text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.5),0_0_30px_hsl(45_100%_50%/0.45)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.8)] transition-shadow"
              >
                <Link to={HERO_CONTENT.primaryCtaHref}>
                  {HERO_CONTENT.primaryCtaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <a
                href={HERO_CONTENT.ghostCtaHref}
                className="text-sm md:text-base font-semibold text-white/85 underline-offset-4 hover:text-[#FFCD05] hover:underline transition-colors"
              >
                {HERO_CONTENT.ghostCtaLabel} →
              </a>
            </div>

            {/* Stats row */}
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 text-xs sm:text-sm text-white/70">
              <li className="font-semibold text-white">{HERO_CONTENT.stats.traders}</li>
              <li aria-hidden className="text-white/30">·</li>
              <li>{HERO_CONTENT.stats.price}</li>
              <li aria-hidden className="text-white/30">·</li>
              <li>{HERO_CONTENT.stats.cadence}</li>
            </ul>
          </div>

          {/* RIGHT — spacer (comet visible behind) */}
          <div className="relative hidden lg:block min-h-[520px]" aria-hidden />
        </div>
      </div>

      {/* Full-width countdown bar */}
      <div className="relative z-10 border-y border-[#FFCD05]/25 bg-gradient-to-r from-[#FFCD05]/10 via-[#FFCD05]/[0.04] to-[#FFCD05]/10 backdrop-blur-md">
        <div className="container flex flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFCD05]/15 text-[#FFCD05]">
              <Radio className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="font-bold text-white">{HERO_CONTENT.countdown.label}</span>
              <span className="text-white/50" aria-hidden>·</span>
              <span className="text-white/80">{HERO_CONTENT.countdown.timeLabel}</span>
              <span className="text-white/50" aria-hidden>·</span>
              {isLive ? (
                <span className="font-bold uppercase tracking-wider text-[#FFCD05] animate-pulse">
                  EN VIVO AHORA
                </span>
              ) : (
                <span className="font-mono font-bold text-[#FFCD05]">
                  en {h}h {String(m).padStart(2, "0")}min
                  <span className="ml-1 text-white/40 text-xs">{String(s).padStart(2, "0")}s</span>
                </span>
              )}
            </div>
          </div>

          <Button
            asChild
            className="h-10 shrink-0 gap-2 rounded-full bg-[#FFCD05] px-5 text-sm font-bold text-black hover:bg-[#FFE066]"
          >
            <Link to={HERO_CONTENT.countdown.reserveHref}>
              <CalendarClock className="h-4 w-4" />
              {HERO_CONTENT.countdown.reserveLabel}
            </Link>
          </Button>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
};

export default HeroSection;
