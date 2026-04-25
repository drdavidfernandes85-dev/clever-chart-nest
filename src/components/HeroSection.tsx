import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock, Play } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedCounter from "@/components/AnimatedCounter";
import MagneticButton from "@/components/MagneticButton";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import { useLanguage } from "@/i18n/LanguageContext";
import infinoxLogo from "@/assets/logo-sidebar.png";


// Next webinar config
const NEXT_WEBINAR = {
  dateUTC: (() => {
    const now = new Date();
    const target = new Date(now);
    target.setUTCHours(14, 0, 0, 0);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    return target;
  })(),
};

function useCountdown(target: Date) {
  const [diff, setDiff] = useState(() => Math.max(0, target.getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, target.getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s, isLive: diff === 0 };
}

const HeroSection = () => {
  const { h, m, s, isLive } = useCountdown(NEXT_WEBINAR.dateUTC);
  const { t } = useLanguage();

  return (
    <section
      id="home"
      className="relative pt-16 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 90% 70% at 70% 50%, #0a0a12 0%, #050509 60%, #000000 100%)",
      }}
    >
      {/* ── DEEP BACKGROUND GRADIENT LAYERS ─────────────────────── */}
      {/* Subtle ambient warm glow on the far left */}
      <div
        className="pointer-events-none absolute inset-0 -z-[3]"
        style={{
          background:
            "radial-gradient(ellipse 45% 60% at 5% 50%, hsl(28 100% 45% / 0.18), transparent 70%)",
        }}
      />

      {/* Vignette to deepen edges */}
      <div
        className="pointer-events-none absolute inset-0 -z-[2]"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 60% 50%, transparent 30%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      {/* Floating embers across whole hero */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="absolute block rounded-full bg-primary/70 animate-ember"
            style={{
              left: `${(i * 47) % 100}%`,
              top: `${(i * 31) % 100}%`,
              width: `${2 + (i % 4)}px`,
              height: `${2 + (i % 4)}px`,
              animationDelay: `${(i * 0.6) % 7}s`,
              animationDuration: `${6 + (i % 5)}s`,
              filter: "blur(0.5px)",
              boxShadow: "0 0 8px hsl(var(--primary) / 0.9), 0 0 18px hsl(28 100% 55% / 0.6)",
            }}
          />
        ))}
      </div>

      {/* Full-width fiery comet trail: left edge → logo on the right */}
      <svg
        viewBox="0 0 1600 720"
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full mix-blend-screen"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <radialGradient id="heroFireBurst" cx="78%" cy="48%" r="28%">
            <stop offset="0%" stopColor="hsl(48 100% 92%)" stopOpacity="1" />
            <stop offset="28%" stopColor="hsl(var(--primary))" stopOpacity="0.92" />
            <stop offset="62%" stopColor="hsl(28 100% 52%)" stopOpacity="0.58" />
            <stop offset="100%" stopColor="hsl(12 100% 32%)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroCometTrail" x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="18%" stopColor="hsl(25 100% 47%)" stopOpacity="0.38" />
            <stop offset="48%" stopColor="hsl(35 100% 53%)" stopOpacity="0.78" />
            <stop offset="72%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="90%" stopColor="hsl(48 100% 92%)" stopOpacity="0.92" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="heroFireBlur" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
          <filter id="heroFireSoft" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <g className="animate-flame-flicker" style={{ transformOrigin: "78% 48%" }}>
          <path
            d="M -120 360 C 180 300, 390 300, 610 342 C 820 382, 1030 415, 1265 350 C 1360 323, 1455 305, 1640 330 L 1640 485 C 1410 450, 1280 456, 1110 410 C 835 335, 575 445, 330 396 C 135 357, 5 414, -120 445 Z"
            fill="url(#heroCometTrail)"
            filter="url(#heroFireBlur)"
            opacity="0.86"
          />
        </g>
        <g className="animate-flame-stream" style={{ transformOrigin: "left center", animationDuration: "2.4s" }}>
          <path
            d="M -60 365 C 260 330, 580 352, 850 370 C 1045 383, 1215 355, 1380 325"
            fill="none"
            stroke="url(#heroCometTrail)"
            strokeWidth="62"
            strokeLinecap="round"
            filter="url(#heroFireSoft)"
            opacity="0.95"
          />
          <path
            d="M 60 362 C 365 350, 610 367, 890 376 C 1085 382, 1212 356, 1398 320"
            fill="none"
            stroke="hsl(48 100% 92%)"
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#heroFireSoft)"
            opacity="0.72"
          />
        </g>
        <ellipse cx="1270" cy="350" rx="300" ry="155" fill="url(#heroFireBurst)" filter="url(#heroFireBlur)" opacity="0.95" />
      </svg>

      {/* Live market ticker */}
      <div className="relative z-10 mx-auto mt-2 max-w-[min(1200px,92%)] overflow-hidden rounded-full border border-primary/40 bg-black/60 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/90 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/90 to-transparent z-10" />
        <ForexTickerBar />
      </div>

      {/* ── HERO CONTENT ───────────────────────────────────────── */}
      <div className="container relative z-10 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          {/* LEFT — copy */}
          <div className="relative flex flex-col items-start gap-7 text-left">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/50 bg-primary/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary backdrop-blur-sm shadow-[0_0_30px_hsl(45_100%_50%/0.25)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {t("hero.powered")}
            </div>

            <h1 className="font-heading text-5xl font-bold leading-[1.02] tracking-tight text-white md:text-6xl lg:text-7xl">
              <span className="drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">{t("hero.title1")}</span>{" "}
              <span className="text-primary drop-shadow-[0_0_28px_hsl(45_100%_50%/0.8)]">|</span>
              <br />
              <span className="drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">{t("hero.title2")}</span>{" "}
              <span
                className="bg-gradient-to-r from-[#FFCD05] via-[#FFE066] to-[#f5a623] bg-clip-text text-transparent drop-shadow-[0_0_40px_hsl(45_100%_50%/0.6)]"
              >
                {t("hero.title3")}
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed font-sans text-white/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {t("hero.desc")}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <MagneticButton strength={0.25}>
                <Button
                  size="lg"
                  className="h-14 gap-2 rounded-full px-10 text-base font-bold bg-[#FFCD05] text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.6),0_0_30px_hsl(45_100%_50%/0.6),0_0_70px_hsl(28_100%_55%/0.45)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.85),0_0_100px_hsl(28_100%_55%/0.65)] transition-shadow"
                  asChild
                >
                  <Link to="/register">
                    {t("hero.cta")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </MagneticButton>
              <MagneticButton strength={0.2}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 gap-2 rounded-full px-8 text-sm border-white/30 bg-white/5 text-white hover:bg-white/10 hover:border-primary/70 backdrop-blur-md"
                  asChild
                >
                  <Link to="/login">
                    <Play className="h-4 w-4 fill-current" />
                    {t("hero.demo")}
                  </Link>
                </Button>
              </MagneticButton>
            </div>

            {/* Social proof + countdown */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 backdrop-blur-md">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-white">1,200+</span>
                <span className="text-xs text-white/60">{t("hero.traders")}</span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 backdrop-blur-md shadow-[0_0_25px_hsl(45_100%_50%/0.25)]">
                <Clock className="h-4 w-4 text-primary" />
                {isLive ? (
                  <span className="text-sm font-bold text-primary animate-pulse">{t("hero.live")}</span>
                ) : (
                  <>
                    <span className="text-xs text-white/70 mr-1">{t("hero.next")}</span>
                    <div className="flex items-center gap-1 font-mono text-sm font-bold text-white">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{String(h).padStart(2, "0")}h</span>
                      <span className="text-white/50">:</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{String(m).padStart(2, "0")}m</span>
                      <span className="text-white/50">:</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{String(s).padStart(2, "0")}s</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { value: "75%", label: t("hero.winrate") },
                { value: "99.8%", label: t("hero.uptime") },
                { value: "5K+", label: t("hero.tradersLabel") },
              ].map((stat) => (
                <div key={stat.label} className="text-left">
                  <div className="font-display text-4xl font-semibold tabular-nums text-white drop-shadow-[0_0_20px_hsl(45_100%_50%/0.3)]">
                    <AnimatedCounter value={stat.value} />
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-white/55">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — official InfinoX logo hit by the left-to-right comet trail */}
          <div className="relative z-10 flex items-center justify-center min-h-[460px] lg:min-h-[600px]">
            {/* Warm radial halo behind ring */}
            <div
              className="absolute inset-0 -z-[1] animate-pulse-glow"
              style={{
                background:
                  "radial-gradient(circle at 62% 50%, hsl(var(--primary) / 0.58), hsl(28 100% 50% / 0.27) 35%, transparent 68%)",
                filter: "blur(42px)",
              }}
            />

            {/* Impact sparks around the exact logo */}
            <div className="pointer-events-none absolute inset-0 -z-[1] overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => {
                const left = 18 + (i * 7) % 70;
                const top = 22 + (i * 13) % 58;
                const dx = 35 + ((i * 17) % 115);
                const dy = -150 + ((i * 19) % 220);
                const size = 2 + (i % 4);
                return (
                  <span
                    key={i}
                    className="absolute block rounded-full bg-primary animate-spark-rise"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      // @ts-ignore custom CSS vars
                      "--sx": `${dx}px`,
                      "--sy": `${dy}px`,
                      animationDelay: `${(i * 0.18) % 3.4}s`,
                      animationDuration: `${2.5 + (i % 5) * 0.38}s`,
                      boxShadow:
                        "0 0 10px hsl(var(--primary) / 0.95), 0 0 24px hsl(28 100% 55% / 0.76)",
                      filter: "blur(0.25px)",
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>

            {/* Drifting ambient particles */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute block rounded-full bg-primary/60 animate-particle-drift"
                  style={{
                    left: `${(i * 23) % 95}%`,
                    top: `${(i * 17) % 90}%`,
                    width: `${1.5 + (i % 3)}px`,
                    height: `${1.5 + (i % 3)}px`,
                    // @ts-ignore custom CSS vars
                    "--dx": `${-30 + ((i * 11) % 60)}px`,
                    "--dy": `${-20 - ((i * 9) % 40)}px`,
                    animationDelay: `${(i * 0.5) % 8}s`,
                    animationDuration: `${7 + (i % 5)}s`,
                    boxShadow: "0 0 6px hsl(var(--primary) / 0.9)",
                  } as React.CSSProperties}
                />
              ))}
            </div>

            {/* ── Official InfinoX logo asset, same as navbar (animated) ── */}
            <div className="relative animate-float">
              {/* Slow rotating outer halo */}
              <div
                className="absolute -inset-8 rounded-full animate-spin-slow"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary) / 0.45) 60deg, transparent 120deg, transparent 240deg, hsl(28 100% 55% / 0.35) 300deg, transparent 360deg)",
                  filter: "blur(22px)",
                }}
              />
              {/* Pulsing glow that wraps the exact logo mark */}
              <div
                className="absolute inset-0 rounded-full animate-pulse-glow"
                style={{
                  boxShadow:
                    "0 0 80px hsl(var(--primary) / 0.8), 0 0 160px hsl(28 100% 55% / 0.55), 0 0 240px hsl(15 100% 55% / 0.35)",
                }}
              />

              <div className="relative h-64 w-64 md:h-80 md:w-80 lg:h-[22rem] lg:w-[22rem] animate-breathe">
                <img
                  src={infinoxLogo}
                  alt="InfinoX"
                  width={1024}
                  height={1024}
                  className="h-full w-full object-contain select-none"
                  draggable={false}
                  loading="eager"
                  decoding="async"
                  style={{
                    filter:
                      "drop-shadow(0 0 18px rgba(255,255,255,0.7)) drop-shadow(0 0 36px hsl(var(--primary) / 0.75)) drop-shadow(0 0 80px hsl(28 100% 55% / 0.45))",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
};

export default HeroSection;
