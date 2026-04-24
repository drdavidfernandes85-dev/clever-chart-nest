import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedCounter from "@/components/AnimatedCounter";
import MagneticButton from "@/components/MagneticButton";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import { useLanguage } from "@/i18n/LanguageContext";
import heroLaptopBtc from "@/assets/hero-laptop-btc.jpg";

// Next webinar config — update these as needed
const NEXT_WEBINAR = {
  label: "Next Live Session",
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
      {/* Soft brand bloom behind the hero (no flat grid, no full-bleed image) */}
      <div className="pointer-events-none absolute inset-0 -z-[1]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 75% 55% at 30% 30%, hsl(48 100% 51% / 0.10), transparent 65%), radial-gradient(ellipse 60% 45% at 85% 80%, hsl(187 100% 50% / 0.07), transparent 65%)",
          }}
        />
      </div>

      {/* Live market ticker */}
      <div className="relative z-10 mx-auto mt-2 max-w-[min(1200px,92%)] overflow-hidden rounded-full border border-primary/30 bg-card/40 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />
        <ForexTickerBar />
      </div>

      {/* ── Two-column hero: copy on left, premium laptop+BTC visual on right ── */}
      <div className="container relative z-10 py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
          {/* LEFT — copy */}
          <div className="relative flex flex-col items-start gap-7 text-left">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {t("hero.powered")}
            </div>

            <h1 className="font-heading text-5xl font-bold leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-7xl">
              {t("hero.title1")}{" "}
              <span className="text-primary drop-shadow-[0_0_24px_hsl(var(--primary)/0.55)]">|</span>
              <br />
              <span className="text-foreground">{t("hero.title2")}</span>{" "}
              <span className="text-primary drop-shadow-[0_0_28px_hsl(var(--primary)/0.55)]">
                {t("hero.title3")}
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed font-sans text-secondary-foreground">
              {t("hero.desc")}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <MagneticButton strength={0.25}>
                <Button size="lg" className="h-14 gap-2 rounded-full px-10 text-base" asChild>
                  <Link to="/register">
                    {t("hero.cta")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </MagneticButton>
              <MagneticButton strength={0.2}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 gap-2 rounded-full px-8 text-sm backdrop-blur-md"
                  asChild
                >
                  <Link to="/login">{t("hero.demo")}</Link>
                </Button>
              </MagneticButton>
            </div>

            {/* Social proof + countdown */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-4 py-2 backdrop-blur-md">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">1,200+</span>
                <span className="text-xs text-muted-foreground">{t("hero.traders")}</span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 backdrop-blur-md">
                <Clock className="h-4 w-4 text-primary" />
                {isLive ? (
                  <span className="text-sm font-bold text-primary animate-pulse">{t("hero.live")}</span>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground mr-1">{t("hero.next")}</span>
                    <div className="flex items-center gap-1 font-mono text-sm font-bold text-foreground">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{String(h).padStart(2, "0")}h</span>
                      <span className="text-muted-foreground">:</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{String(m).padStart(2, "0")}m</span>
                      <span className="text-muted-foreground">:</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{String(s).padStart(2, "0")}s</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-2 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { value: "75%", label: t("hero.winrate") },
                { value: "99.8%", label: t("hero.uptime") },
                { value: "5K+", label: t("hero.tradersLabel") },
              ].map((stat) => (
                <div key={stat.label} className="text-left">
                  <div className="font-display text-4xl font-semibold tabular-nums text-foreground">
                    <AnimatedCounter value={stat.value} />
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — laptop + BTC visual */}
          <div className="relative">
            {/* Yellow brand bloom behind the visual */}
            <div
              className="pointer-events-none absolute inset-0 -z-[1]"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 50%, hsl(48 100% 51% / 0.18), transparent 70%)",
                filter: "blur(20px)",
              }}
            />
            <div className="relative animate-float">
              <img
                src={heroLaptopBtc}
                alt="Premium crypto trading dashboard with floating Bitcoin"
                width={1920}
                height={1080}
                className="relative z-[1] w-full select-none drop-shadow-[0_30px_80px_hsl(48_100%_51%/0.25)]"
                style={{
                  maskImage:
                    "radial-gradient(ellipse 95% 95% at 50% 50%, black 60%, transparent 100%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 95% 95% at 50% 50%, black 60%, transparent 100%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
