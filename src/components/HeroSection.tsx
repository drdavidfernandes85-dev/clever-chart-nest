import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import heroComet from "@/assets/hero-comet.jpg";
import traderDavid from "@/assets/trader-david.jpg";

// ──────────────────────────────────────────────────────────────
// EDITABLE CONTENT VARIABLES — adjust copy/numbers here.
// Presentational only. No routing / auth / data changes.
// ──────────────────────────────────────────────────────────────
const HERO_COPY = {
  webinarBadge: "Webinar en vivo hoy a las 20:00",
  h1Line1: "Opera en vivo con traders reales.",
  h1Line2: "Sin gurús. Sin promesas.",
  subhead:
    "Aprende a operar con quien opera todos los días: webinars diarios, comunidad real y las herramientas que usan los profesionales — sin mensualidad.",
  ctaPrimary: "Activa tu cuenta gratis",
  ctaPrimaryHref: "/register",
  ctaSecondary: "Ver cómo funciona",
  ctaSecondaryHref: "#platform-pillars",
  stats: {
    traders: "1.200+ traders activos",
    price: "$0 mensualidad",
    cadence: "Webinar diario",
  },
  trader: {
    name: "David",
    role: "Trader profesional · +8 años",
    liveBadge: "Operando en vivo",
    quote: "Te muestro lo que funciona y lo que no.",
  },
  countdown: {
    label: "Próximo webinar en vivo",
    when: "Hoy a las 20:00 (LATAM)",
    cta: "Reservar lugar",
    ctaHref: "/webinars",
  },
};

// Next webinar — today at 20:00 local; rolls to tomorrow if passed.
const NEXT_WEBINAR_TARGET = (() => {
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  return target;
})();

function useCountdown(target: Date) {
  const [diff, setDiff] = useState(() => Math.max(0, target.getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, target.getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const total = Math.floor(diff / 1000);
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
    isLive: diff === 0,
  };
}

const YELLOW = "#FFCD05";

const HeroSection = () => {
  const { h, m, s, isLive } = useCountdown(NEXT_WEBINAR_TARGET);

  return (
    <section
      id="home"
      className="relative isolate w-full overflow-hidden bg-background"
    >
      {/* ── Ambient background (kept from previous hero) ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <img
          src={heroComet}
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority="high"
          className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-40 sm:opacity-50"
          draggable={false}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 30%, rgba(255,205,5,0.10) 0%, transparent 60%), linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.92) 60%, rgba(0,0,0,1) 100%)",
          }}
        />
      </div>

      {/* ── Hero content ── */}
      <div className="container relative z-10 mx-auto px-4 pt-20 pb-10 sm:px-6 sm:pt-24 sm:pb-14 lg:pt-28 lg:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          {/* LEFT — copy */}
          <div className="flex flex-col items-start gap-6 text-left">
            {/* Webinar pill */}
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs sm:text-[13px] font-medium text-white/90 backdrop-blur-md"
              style={{
                borderColor: `${YELLOW}55`,
                background: `${YELLOW}14`,
                boxShadow: `0 0 22px ${YELLOW}33`,
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: YELLOW }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: YELLOW }}
                />
              </span>
              {HERO_COPY.webinarBadge}
            </span>

            {/* H1 — two lines, line 2 yellow */}
            <h1 className="font-heading text-[2.25rem] leading-[1.06] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-[4rem]">
              <span className="block drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
                {HERO_COPY.h1Line1}
              </span>
              <span
                className="block mt-1.5"
                style={{
                  color: YELLOW,
                  textShadow: `0 0 38px ${YELLOW}66`,
                }}
              >
                {HERO_COPY.h1Line2}
              </span>
            </h1>

            {/* Subhead */}
            <p className="max-w-xl text-base sm:text-lg leading-relaxed text-white/80">
              {HERO_COPY.subhead}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 w-full sm:w-auto pt-1">
              <Link
                to={HERO_COPY.ctaPrimaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-heading text-sm sm:text-base font-bold uppercase tracking-wide text-black transition-transform active:scale-[0.98] hover:scale-[1.02] w-full sm:w-auto"
                style={{
                  backgroundColor: YELLOW,
                  boxShadow: `0 12px 40px -10px ${YELLOW}cc, 0 0 0 1px ${YELLOW}`,
                }}
              >
                {HERO_COPY.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={HERO_COPY.ctaSecondaryHref}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors px-2 py-2"
              >
                {HERO_COPY.ctaSecondary}
                <ArrowRight className="h-4 w-4 opacity-70" />
              </a>
            </div>

            {/* Stats row */}
            <ul className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs sm:text-sm text-white/65 pt-2">
              <li className="font-medium text-white/85">{HERO_COPY.stats.traders}</li>
              <li className="text-white/30">·</li>
              <li className="font-medium text-white/85">{HERO_COPY.stats.price}</li>
              <li className="text-white/30">·</li>
              <li className="font-medium text-white/85">{HERO_COPY.stats.cadence}</li>
            </ul>
          </div>

          {/* RIGHT — trader trust card */}
          <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl"
              style={{
                boxShadow: `0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px ${YELLOW}22, 0 0 60px -10px ${YELLOW}33`,
              }}
            >
              {/* Photo */}
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <img
                  src={traderDavid}
                  alt={`${HERO_COPY.trader.name} — ${HERO_COPY.trader.role}`}
                  width={768}
                  height={896}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.95) 100%)",
                  }}
                />

                {/* Live badge */}
                <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-destructive/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-destructive-foreground shadow-[0_0_25px_hsl(var(--destructive)/0.7)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  {HERO_COPY.trader.liveBadge}
                </span>

                {/* Name overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="font-heading text-2xl font-bold text-white leading-tight">
                    {HERO_COPY.trader.name}
                  </p>
                  <p className="text-[12px] sm:text-xs uppercase tracking-wider mt-1" style={{ color: YELLOW }}>
                    {HERO_COPY.trader.role}
                  </p>
                </div>
              </div>

              {/* Quote */}
              <div className="px-5 py-4 border-t border-white/5">
                <p className="text-sm sm:text-base italic text-white/85 leading-snug">
                  <span style={{ color: YELLOW }}>“</span>
                  {HERO_COPY.trader.quote}
                  <span style={{ color: YELLOW }}>”</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full-width countdown bar ── */}
      <div
        className="relative z-10 border-y backdrop-blur-md"
        style={{
          borderColor: `${YELLOW}33`,
          background: `linear-gradient(90deg, ${YELLOW}10 0%, rgba(0,0,0,0.6) 50%, ${YELLOW}10 100%)`,
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${YELLOW}1f`, color: YELLOW }}
              >
                <CalendarClock className="h-4 w-4" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] sm:text-xs uppercase tracking-widest text-white/60 font-mono">
                  {HERO_COPY.countdown.label}
                </span>
                <span className="text-sm sm:text-base font-semibold text-white">
                  {HERO_COPY.countdown.when}
                </span>
                <span className="text-white/30 hidden sm:inline">·</span>
                {isLive ? (
                  <span
                    className="text-sm font-bold animate-pulse"
                    style={{ color: YELLOW }}
                  >
                    EN VIVO AHORA
                  </span>
                ) : (
                  <span className="text-sm font-mono font-bold" style={{ color: YELLOW }}>
                    en {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}min{" "}
                    <span className="text-white/40 text-xs">{String(s).padStart(2, "0")}s</span>
                  </span>
                )}
              </div>
            </div>

            <Link
              to={HERO_COPY.countdown.ctaHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors w-full sm:w-auto"
              style={{
                borderColor: YELLOW,
                color: YELLOW,
                backgroundColor: `${YELLOW}10`,
              }}
            >
              {HERO_COPY.countdown.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
