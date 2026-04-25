import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock, Play } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedCounter from "@/components/AnimatedCounter";
import MagneticButton from "@/components/MagneticButton";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import { useLanguage } from "@/i18n/LanguageContext";
import heroComet from "@/assets/hero-comet.png";


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
      className="relative isolate overflow-hidden pt-16 bg-background"
    >
      {/* ── HERO COMET BACKGROUND IMAGE ──────────────── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Deep dark base for depth */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 65% 50%, hsl(28 80% 8% / 0.6) 0%, hsl(0 0% 2%) 75%)",
          }}
        />

        {/* Soft pulsing yellow halo behind the logo zone */}
        <div
          className="absolute top-1/2 right-[14%] -translate-y-1/2 h-[460px] w-[460px] rounded-full animate-pulse-glow"
          style={{
            background:
              "radial-gradient(circle, hsl(45 100% 55% / 0.22) 0%, hsl(28 100% 50% / 0.12) 40%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />

        {/* Cinematic comet+logo image — full bleed, anchored right, breathing animation */}
        <img
          src={heroComet}
          alt=""
          aria-hidden
          className="absolute right-0 top-1/2 -translate-y-1/2 h-full min-h-[460px] w-auto max-w-none scale-110 object-contain select-none md:h-[120%] lg:right-[-2%] animate-breathe"
          draggable={false}
          style={{
            filter: "drop-shadow(0 0 60px hsl(28 100% 50% / 0.35))",
          }}
        />

        {/* Soft left fade so text is readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.78) 22%, rgba(0,0,0,0.30) 48%, rgba(0,0,0,0) 72%)",
          }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 110% 85% at 60% 50%, transparent 45%, rgba(0,0,0,0.55) 82%, rgba(0,0,0,0.95) 100%)",
          }}
        />
      </div>

      {/* Floating embers + bright sparks */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="absolute block rounded-full bg-primary/80 animate-ember"
            style={{
              left: `${(i * 37) % 95}%`,
              top: `${30 + ((i * 19) % 60)}%`,
              width: `${2 + (i % 4)}px`,
              height: `${2 + (i % 4)}px`,
              animationDelay: `${(i * 0.4) % 7}s`,
              animationDuration: `${5 + (i % 5)}s`,
              filter: "blur(0.5px)",
              boxShadow:
                "0 0 8px hsl(var(--primary) / 0.95), 0 0 18px hsl(28 100% 55% / 0.7)",
            }}
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={`sp-${i}`}
            className="absolute block rounded-full animate-spark-rise"
            style={{
              left: `${55 + ((i * 5) % 20)}%`,
              top: `${45 + ((i * 7) % 20)}%`,
              width: "3px",
              height: "3px",
              background: "hsl(48 100% 70%)",
              boxShadow:
                "0 0 10px hsl(45 100% 60% / 1), 0 0 22px hsl(28 100% 55% / 0.9)",
              animationDelay: `${(i * 0.5) % 4}s`,
              ["--sx" as any]: `${-30 + i * 12}px`,
              ["--sy" as any]: `${-160 - (i % 3) * 30}px`,
            }}
          />
        ))}
      </div>

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

          {/* RIGHT — empty spacer; the comet+logo is the section background image */}
          <div className="relative hidden lg:block min-h-[600px]" aria-hidden />
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
};

export default HeroSection;
