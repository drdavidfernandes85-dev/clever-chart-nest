import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedCounter from "@/components/AnimatedCounter";
import MagneticButton from "@/components/MagneticButton";
import AnimatedTradingChart from "@/components/hero/AnimatedTradingChart";
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
    <section id="home" className="relative overflow-hidden pt-16">
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="absolute inset-0 bg-radial-glow" />
      <div className="absolute top-16 left-0 right-0 cyber-line" />

      <div className="container relative flex min-h-[92vh] flex-col items-center justify-center gap-16 py-20 lg:flex-row">
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2.5 text-sm text-secondary-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-slow" />
            {t("hero.powered")}
          </div>

          <h1 className="font-heading text-5xl font-bold leading-[1.05] text-foreground md:text-6xl lg:text-7xl uppercase tracking-tight">
            {t("hero.title1")}
            <br />
            <span className="text-gradient">{t("hero.title2")}</span>{" "}
            <span className="text-foreground">{t("hero.title3")}</span>
          </h1>

          <p className="max-w-lg text-base leading-relaxed font-sans text-secondary-foreground">
            {t("hero.desc")}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <MagneticButton strength={0.25}>
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/80 gap-2 h-12 px-8 text-sm font-semibold rounded-full shadow-[0_10px_40px_-10px_hsl(48_100%_51%/0.6)]"
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
                className="border-border bg-transparent text-foreground hover:bg-secondary gap-2 h-12 px-8 text-sm rounded-full"
                asChild
              >
                <Link to="/login">
                  {t("hero.demo")}
                </Link>
              </Button>
            </MagneticButton>
          </div>

          {/* Social Proof + Countdown Row */}
          <div className="flex flex-wrap items-center gap-6 pt-4">
            {/* Social proof */}
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-4 py-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">1,200+</span>
              <span className="text-xs text-muted-foreground">{t("hero.traders")}</span>
            </div>

            {/* Webinar countdown */}
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2">
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

          <div className="flex gap-10 pt-2">
            {[
              { value: "75%", label: t("hero.winrate") },
              { value: "99.8%", label: t("hero.uptime") },
              { value: "5K+", label: t("hero.tradersLabel") },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-4xl font-semibold text-foreground tabular-nums">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 w-full flex items-center justify-center">
          <div className="relative w-full max-w-xl">
            {/* Soft gold glow behind */}
            <div
              className="absolute -inset-10 rounded-full blur-3xl opacity-60"
              style={{
                background:
                  "radial-gradient(circle, hsl(48 100% 51% / 0.25), transparent 70%)",
              }}
              aria-hidden="true"
            />
            <img
              src={heroFintech}
              alt="Premium gold rising trading chart visualization"
              width={1280}
              height={1280}
              className="relative w-full h-auto rounded-2xl"
              style={{
                maskImage:
                  "radial-gradient(ellipse 85% 85% at 50% 50%, black 55%, transparent 95%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 85% 85% at 50% 50%, black 55%, transparent 95%)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 cyber-line" />
    </section>
  );
};

export default HeroSection;
