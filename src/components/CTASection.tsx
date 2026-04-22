import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";

const CTASection = () => {
  const { t } = useLanguage();

  return (
    <section className="py-28">
      <div className="container">
        <ScrollReveal>
          <div className="shimmer-border relative overflow-hidden rounded-3xl glass-panel px-6 py-20 text-center md:px-16">
            {/* Ambient glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(48_100%_51%/0.12),transparent_70%)]" />
            {/* Faint connected node network — community motif */}
            <svg
              viewBox="0 0 600 220"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
              aria-hidden="true"
            >
              <g stroke="hsl(48 100% 60% / 0.35)" strokeWidth="0.5" fill="none">
                <line x1="60" y1="40" x2="180" y2="90" />
                <line x1="180" y1="90" x2="320" y2="50" />
                <line x1="320" y1="50" x2="460" y2="100" />
                <line x1="460" y1="100" x2="540" y2="55" />
                <line x1="180" y1="90" x2="240" y2="170" />
                <line x1="320" y1="50" x2="380" y2="180" />
                <line x1="460" y1="100" x2="500" y2="180" />
              </g>
              <g fill="hsl(48 100% 60%)">
                {[
                  [60, 40], [180, 90], [320, 50], [460, 100], [540, 55],
                  [240, 170], [380, 180], [500, 180],
                ].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.6 : 1.8} opacity={0.6} />
                ))}
              </g>
            </svg>

            {/* Top + bottom hairlines */}
            <div className="absolute top-0 left-0 right-0 gold-divider" />
            <div className="absolute bottom-0 left-0 right-0 gold-divider" />

            <div className="relative z-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {t("hero.live")}
              </div>
              <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
                {t("cta.title1")} <span className="text-gradient">{t("cta.title2")}</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base text-secondary-foreground">
                {t("cta.desc")}
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/80 gap-2 h-12 px-8 text-sm font-semibold rounded-full shadow-[0_10px_40px_-10px_hsl(48_100%_51%/0.6)]"
                  asChild
                >
                  <Link to="/register">
                    {t("cta.join")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border bg-transparent text-foreground hover:bg-secondary font-semibold h-12 px-8 text-sm rounded-full"
                  asChild
                >
                  <Link to="/login">{t("nav.login")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default CTASection;
