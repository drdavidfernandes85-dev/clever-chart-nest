import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedCounter from "@/components/AnimatedCounter";
import MagneticButton from "@/components/MagneticButton";
import FloatingCandles from "@/components/hero/FloatingCandles";
import NetworkNodes from "@/components/hero/NetworkNodes";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import { useLanguage } from "@/i18n/LanguageContext";
import heroCryptoBg from "@/assets/hero-crypto-bg.jpg";

// Next webinar config — update these as needed
const NEXT_WEBINAR = {
  label: "Next Live Session",
  // Set to the next session date/time in UTC
  dateUTC: (() => {
    const now = new Date();
    const target = new Date(now);
    target.setUTCHours(14, 0, 0, 0); // 14:00 UTC daily
    // If today's session already passed, move to tomorrow
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    // Skip weekends
    while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    return target;
  })(),
};

function useCountdown(target: Date) {
  const [diff, setDiff] = useState(() => Math.max(0, target.getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setDiff(Math.max(0, target.getTime() - Date.now()));
    }, 1000);
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
    <section id="home" className="relative pt-16 overflow-hidden">
      {/* Premium dramatic hero backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-[1]">
        <img
          src={heroCryptoBg}
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(0 0% 1% / 0.30) 0%, hsl(0 0% 1% / 0.55) 60%, hsl(0 0% 1% / 0.95) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 35%, hsl(48 100% 51% / 0.10), transparent 70%)",
          }}
        />
      </div>

      {/* Live market ticker — same live feed as the dashboard */}
      <div className="relative z-10 mx-auto mt-2 max-w-[min(1200px,92%)] overflow-hidden rounded-full border border-primary/30 bg-card/40 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />
        <ForexTickerBar />
      </div>

      {/* ── Centered hero with side ornaments (matches reference) ── */}
      <div className="container relative z-10 min-h-[88vh] py-16">
        {/* Floating candles — left side */}
        <FloatingCandles
          side="left"
          className="absolute left-0 top-1/2 hidden -translate-y-1/2 w-[22rem] h-[34rem] md:block animate-float"
        />
        {/* Network nodes — right side */}
        <NetworkNodes className="absolute right-0 top-1/2 hidden -translate-y-1/2 w-[22rem] h-[34rem] md:block animate-float" />

        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
          {/* Proxima Nova / brand pill */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary/90 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {t("hero.powered")}
          </div>

          <h1 className="font-heading text-5xl font-bold leading-[1.05] text-foreground md:text-6xl lg:text-7xl tracking-tight">
            {t("hero.title1")}{" "}
            <span className="text-primary">|</span>
            <br />
            <span className="text-foreground">{t("hero.title2")} {t("hero.title3")}</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed font-sans text-secondary-foreground">
            {t("hero.desc")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <MagneticButton strength={0.25}>
              <Button
                size="lg"
                className="relative h-14 gap-2 rounded-full bg-primary px-10 text-base font-bold text-primary-foreground ring-1 ring-primary/20 transition-colors duration-300 hover:bg-primary/90"
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
                className="border-border bg-card/40 text-foreground hover:bg-secondary gap-2 h-14 px-8 text-sm rounded-full backdrop-blur-md"
                asChild
              >
                <Link to="/login">{t("hero.demo")}</Link>
              </Button>
            </MagneticButton>
          </div>

          {/* Social Proof + Countdown Row */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-4 py-2 backdrop-blur-md">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">1,200+</span>
              <span className="text-xs text-muted-foreground">{t("hero.traders")}</span>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 backdrop-blur-md">
              <Clock className="h-4 w-4 text-primary" />
              {isLive ? (
                <span className="text-sm font-bold text-primary animate-pulse">{t("hero.live")}</span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground mr-1">{t("hero.next")}</span>
                  <div className="flex items-center gap-1 font-mono text-sm font-bold text-foreground">
                    <span className="bg-secondary rounded px-1.5 py-0.5 text-xs">{String(h).padStart(2, "0")}h</span>
                    <span className="text-muted-foreground">:</span>
                    <span className="bg-secondary rounded px-1.5 py-0.5 text-xs">{String(m).padStart(2, "0")}m</span>
                    <span className="text-muted-foreground">:</span>
                    <span className="bg-secondary rounded px-1.5 py-0.5 text-xs">{String(s).padStart(2, "0")}s</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 pt-6">
            {[
              { value: "75%", label: t("hero.winrate") },
              { value: "99.8%", label: t("hero.uptime") },
              { value: "5K+", label: t("hero.tradersLabel") },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-4xl font-semibold text-foreground tabular-nums">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
