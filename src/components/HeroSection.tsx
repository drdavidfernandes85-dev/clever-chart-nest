import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedCounter from "@/components/AnimatedCounter";
import MagneticButton from "@/components/MagneticButton";
import HeroParticles from "@/components/hero/HeroParticles";
import FloatingCandles from "@/components/hero/FloatingCandles";
import NetworkNodes from "@/components/hero/NetworkNodes";
import { useLanguage } from "@/i18n/LanguageContext";

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
    <section id="home" className="relative pt-16">
      {/* Page-wide ambient layer — extends beyond the section so it bleeds into neighbors */}
      <div
        className="pointer-events-none absolute -inset-x-[20%] -top-40 -bottom-60 z-0"
        aria-hidden="true"
      >
        {/* Soft gold ambient core, sits behind the laptop */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 70% 45%, hsl(48 95% 55% / 0.22) 0%, hsl(40 80% 45% / 0.10) 35%, transparent 70%)",
          }}
        />
        {/* Green chart spill — picks up the candlestick green from the laptop screen */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 45% 35% at 68% 55%, hsl(140 70% 45% / 0.10) 0%, transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Counter-balance glow on the copy side */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 20% 35%, hsl(45 90% 50% / 0.10) 0%, transparent 65%)",
          }}
        />
        {/* Faint grid, masked to fade out at all edges (no hard cutoff anywhere) */}
        <div
          className="absolute inset-0 bg-grid-pattern opacity-[0.12]"
          style={{
            maskImage:
              "radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 85%)",
          }}
        />
        {/* Page-wide vignette — darkens edges so the bright glow feels embedded */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 40%, hsl(0 0% 4% / 0.45) 80%, hsl(0 0% 3% / 0.85) 100%)",
          }}
        />
        {/* Bottom seam — fades the entire ambient layer into the next section */}
        <div
          className="absolute inset-x-0 bottom-0 h-72"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, hsl(0 0% 7% / 0.6) 60%, hsl(0 0% 7%) 100%)",
          }}
        />
      </div>

      {/* Parallax dust + particles — gold/green tinted to match the laptop screen */}
      <HeroParticles />

      {/* Live market ticker — sits above the fold for instant "trading" identity */}
      <div
        className="relative z-10 mx-auto mt-2 max-w-[min(1200px,92%)] overflow-hidden rounded-full border border-border/60 bg-card/40 backdrop-blur-md"
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex w-max animate-ticker py-2 font-mono text-[11px] tracking-widest text-foreground/70">
          {[...Array(2)].map((_, dup) => (
            <div className="flex shrink-0" key={dup}>
              {[
                ["XAU/USD", "2,412.50", "+12.40", "up"],
                ["EUR/USD", "1.0942", "+0.0014", "up"],
                ["GBP/JPY", "192.45", "-0.15", "down"],
                ["BTC/USD", "64,210", "+840.00", "up"],
                ["DXY", "104.20", "-0.05", "down"],
                ["US30", "39,820", "+128.00", "up"],
                ["NAS100", "18,540", "+92.30", "up"],
                ["WTI", "78.42", "-0.22", "down"],
              ].map(([sym, price, chg, dir], i) => (
                <span key={`${dup}-${i}`} className="flex items-center gap-2 px-6 whitespace-nowrap">
                  <span className="font-semibold text-foreground/90">{sym}</span>
                  <span className="tabular-nums">{price}</span>
                  <span
                    className={`tabular-nums ${
                      dir === "up" ? "text-[hsl(145_65%_50%)]" : "text-[hsl(0_70%_55%)]"
                    }`}
                  >
                    {dir === "up" ? "▲" : "▼"} {chg}
                  </span>
                  <span className="text-border">|</span>
                </span>
              ))}
            </div>
          ))}
        </div>
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

          {/* Glowing INFINOX-yellow CTA */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <MagneticButton strength={0.25}>
              <Button
                size="lg"
                className="relative bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-14 px-10 text-base font-bold rounded-full
                           shadow-[0_0_60px_-5px_hsl(48_100%_51%/0.7),0_10px_40px_-10px_hsl(48_100%_51%/0.8)]
                           ring-1 ring-primary/40
                           transition-shadow duration-500 hover:shadow-[0_0_80px_-2px_hsl(48_100%_51%/0.95)]"
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
      </div>

      
    </section>
  );
};

export default HeroSection;
