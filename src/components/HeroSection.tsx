import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, AlertTriangle, Clock, LayoutDashboard, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import MagneticButton from "@/components/MagneticButton";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import { FreeWebinarTrigger } from "@/components/lead/FreeWebinarModal";
import OnlineNowPill from "@/components/social/OnlineNowPill";
import { useLanguage } from "@/i18n/LanguageContext";
import heroComet from "@/assets/hero-comet.jpg";

// Next webinar — next weekday at 14:00 UTC
const NEXT_WEBINAR_TARGET = (() => {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(14, 0, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
})();

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
  
  const { h, m, s, isLive } = useCountdown(NEXT_WEBINAR_TARGET);
  const { t } = useLanguage();

  return (
    <section
      id="home"
      className="relative isolate mx-auto w-full max-w-[1400px] overflow-hidden pt-16 bg-background"
    >
      {/* ── HERO COMET BACKGROUND IMAGE ──────────────── */}
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
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="absolute inset-y-0 right-0 h-full w-[82%] object-contain object-right select-none animate-breathe"
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
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 115% 90% at 62% 50%, transparent 42%, rgba(0,0,0,0.60) 80%, rgba(0,0,0,0.98) 100%)",
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
        <ForexTickerBar live={false} />
      </div>

      {/* ── HERO CONTENT ───────────────────────────────────────── */}
      <div className="container relative z-10 py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:grid-cols-[1.1fr_1fr] xl:gap-20">
          {/* LEFT — copy */}
          <div className="relative flex flex-col items-start gap-6 text-left lg:pl-4 xl:pl-2 2xl:pl-0">
            {/* Headline */}
            <h1 className="font-heading text-5xl font-bold leading-[1.04] tracking-tight text-white md:text-6xl lg:text-7xl">
              <span className="drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">{t("hero.headline.lead")}</span>{" "}
              <span className="bg-gradient-to-r from-[#FFCD05] via-[#FFE066] to-[#f5a623] bg-clip-text text-transparent drop-shadow-[0_0_40px_hsl(45_100%_50%/0.6)]">
                {t("hero.headline.brand")}
              </span>
              <br />
              <span className="drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">{t("hero.headline.tail")}</span>
            </h1>

            {/* Sub-headline */}
            <p className="max-w-xl text-base md:text-lg leading-relaxed font-sans text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {t("hero.subheadline")}
            </p>

            {/* CTAs — single primary + supporting secondary */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <MagneticButton strength={0.25}>
                <Button
                  size="lg"
                  className="h-14 gap-2 rounded-full px-9 text-base font-bold bg-[#FFCD05] text-black hover:bg-[#FFE066] cta-pulse shadow-[0_0_0_1px_hsl(45_100%_50%/0.6),0_0_30px_hsl(45_100%_50%/0.6),0_0_70px_hsl(28_100%_55%/0.45)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.85),0_0_100px_hsl(28_100%_55%/0.65)] transition-shadow"
                  asChild
                >
                  <Link to="/register">
                    {t("hero.cta")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </MagneticButton>
              <MagneticButton strength={0.22}>
                <FreeWebinarTrigger
                  source="hero"
                  className="h-14 gap-2 rounded-full bg-[#FFCD05]/15 border border-primary/60 px-7 text-base font-bold text-primary hover:bg-primary/25 backdrop-blur-md shadow-[0_0_25px_hsl(45_100%_50%/0.25)]"
                />
              </MagneticButton>
              <Button
                size="lg"
                variant="ghost"
                className="h-14 gap-2 rounded-full px-5 text-sm font-medium text-white/70 hover:text-primary hover:bg-white/5"
                asChild
              >
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Dashboard
                </Link>
              </Button>
            </div>

            {/* Eligibility note — subtle */}
            <p className="max-w-2xl text-xs leading-relaxed text-white/55">
              Full access requires a verified live Infinox account with a minimum net balance of $100 USD. All content is for educational purposes only.
            </p>

            {/* Trust strip — Active traders, Next session countdown, Community */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
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

              <OnlineNowPill />
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 backdrop-blur-md">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm text-white/85">Community of active traders &amp; mentors</span>
              </div>
            </div>

            {/* Risk disclaimer */}
            <div className="mt-2 flex w-full max-w-xl items-start gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/60" />
              <p className="text-xs leading-relaxed text-white/65">
                Trading involves significant risk. Past performance is not indicative of future results.
              </p>
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
