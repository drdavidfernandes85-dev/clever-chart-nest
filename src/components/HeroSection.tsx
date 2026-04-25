import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock, Play } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedCounter from "@/components/AnimatedCounter";
import MagneticButton from "@/components/MagneticButton";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import { useLanguage } from "@/i18n/LanguageContext";
import heroFlamesBg from "@/assets/hero-flames-bg.jpg";

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
    <section id="home" className="relative pt-16 overflow-hidden bg-[#0a0a12]">
      {/* ── FIERY BACKGROUND LAYERS ────────────────────────────── */}
      {/* Base flame photograph */}
      <div
        className="pointer-events-none absolute inset-0 -z-[3] bg-cover bg-center opacity-90"
        style={{ backgroundImage: `url(${heroFlamesBg})` }}
      />
      {/* Vignette to deepen the void */}
      <div
        className="pointer-events-none absolute inset-0 -z-[2]"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, rgba(5,5,12,0.55) 60%, rgba(5,5,12,0.95) 100%)",
        }}
      />
      {/* Warm ember glow on the left */}
      <div
        className="pointer-events-none absolute inset-0 -z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 18% 60%, hsl(28 100% 55% / 0.25), transparent 70%), radial-gradient(ellipse 40% 35% at 8% 65%, hsl(45 100% 50% / 0.18), transparent 70%)",
        }}
      />

      {/* Floating embers */}
      <div className="pointer-events-none absolute inset-0 -z-[1] overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute block rounded-full bg-primary/70 animate-ember"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 31) % 100}%`,
              width: `${2 + (i % 4)}px`,
              height: `${2 + (i % 4)}px`,
              animationDelay: `${(i * 0.7) % 6}s`,
              animationDuration: `${6 + (i % 5)}s`,
              filter: "blur(0.5px)",
              boxShadow: "0 0 8px hsl(45 100% 55% / 0.9), 0 0 18px hsl(28 100% 55% / 0.6)",
            }}
          />
        ))}
      </div>

      {/* Right-side yellow geometric accent (sharp triangle) */}
      <div className="pointer-events-none absolute -right-32 top-1/3 -z-[1] hidden lg:block">
        <div
          className="h-[520px] w-[520px] opacity-90"
          style={{
            background: "linear-gradient(135deg, #FFCD05 0%, #f5a623 100%)",
            clipPath: "polygon(0 0, 100% 50%, 0 100%)",
            filter: "drop-shadow(0 0 60px hsl(45 100% 50% / 0.4))",
          }}
        />
      </div>

      {/* Live market ticker */}
      <div className="relative z-10 mx-auto mt-2 max-w-[min(1200px,92%)] overflow-hidden rounded-full border border-primary/40 bg-black/50 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/80 to-transparent z-10" />
        <ForexTickerBar />
      </div>

      {/* ── HERO CONTENT ───────────────────────────────────────── */}
      <div className="container relative z-10 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
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
              <span className="drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]">{t("hero.title1")}</span>{" "}
              <span className="text-primary drop-shadow-[0_0_28px_hsl(45_100%_50%/0.7)]">|</span>
              <br />
              <span className="drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]">{t("hero.title2")}</span>{" "}
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
                  className="h-14 gap-2 rounded-full px-10 text-base bg-[#FFCD05] text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.6),0_0_30px_hsl(45_100%_50%/0.55),0_0_70px_hsl(28_100%_55%/0.4)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.8),0_0_90px_hsl(28_100%_55%/0.6)] transition-shadow"
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
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 backdrop-blur-md">
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

          {/* RIGHT — glowing IX comet ring */}
          <div className="relative flex items-center justify-center min-h-[420px] lg:min-h-[560px]">
            {/* Outer warm glow halo */}
            <div
              className="absolute inset-0 -z-[1]"
              style={{
                background:
                  "radial-gradient(circle at 55% 50%, hsl(45 100% 55% / 0.35), hsl(28 100% 50% / 0.15) 40%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />

            {/* Comet trail behind ring */}
            <div className="absolute inset-y-0 left-0 right-1/3 -z-[1] overflow-hidden">
              <div
                className="absolute top-1/2 left-0 h-32 w-full -translate-y-1/2 animate-comet"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, hsl(45 100% 55% / 0.8) 30%, hsl(28 100% 55% / 0.95) 60%, hsl(15 100% 50% / 0.6) 85%, transparent 100%)",
                  filter: "blur(18px)",
                  borderRadius: "50%",
                }}
              />
              <div
                className="absolute top-1/2 left-0 h-16 w-full -translate-y-1/2 animate-comet"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, hsl(45 100% 70% / 0.95) 50%, hsl(45 100% 60% / 0.7) 80%, transparent 100%)",
                  filter: "blur(8px)",
                  borderRadius: "50%",
                  animationDelay: "0.4s",
                }}
              />
            </div>

            {/* The glowing IX ring */}
            <div className="relative animate-float">
              {/* Pulsing outer ring glow */}
              <div
                className="absolute inset-0 rounded-full animate-pulse-glow"
                style={{
                  boxShadow:
                    "0 0 60px hsl(45 100% 55% / 0.6), 0 0 120px hsl(28 100% 55% / 0.45), 0 0 200px hsl(15 100% 55% / 0.3)",
                }}
              />
              {/* White luminous ring */}
              <div className="relative h-64 w-64 rounded-full border-[14px] border-white shadow-[inset_0_0_30px_rgba(255,255,255,0.6),0_0_60px_rgba(255,255,255,0.5)] md:h-80 md:w-80 lg:h-[22rem] lg:w-[22rem]">
                {/* Inner yellow play arrow */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="ml-4 h-0 w-0"
                    style={{
                      borderTop: "60px solid transparent",
                      borderBottom: "60px solid transparent",
                      borderLeft: "90px solid #FFCD05",
                      filter: "drop-shadow(0 0 30px hsl(45 100% 50% / 0.8))",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Floating sparks around the ring */}
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-primary animate-ember"
                  style={{
                    left: `${30 + (i * 11) % 50}%`,
                    top: `${20 + (i * 17) % 60}%`,
                    animationDelay: `${i * 0.5}s`,
                    boxShadow: "0 0 12px hsl(45 100% 60% / 0.95), 0 0 24px hsl(28 100% 55% / 0.7)",
                  }}
                />
              ))}
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
