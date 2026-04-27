import { GraduationCap, LineChart, Video, ShieldCheck } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import { useLanguage } from "@/i18n/LanguageContext";

const featurePoints: { icon: typeof LineChart; title: string; desc: string }[] = [
  {
    icon: GraduationCap,
    title: "Educational Community Environment",
    desc: "A professional space where traders connect, share ideas and grow together — built for learning, not hype.",
  },
  {
    icon: LineChart,
    title: "Real-Time Chart Analysis & Discussion",
    desc: "Live market breakdowns and open discussion of setups across FX, indices, commodities and crypto.",
  },
  {
    icon: Video,
    title: "Access to Daily Live Webinars",
    desc: "Daily sessions hosted by seasoned mentors with live market analysis, walkthroughs and Q&A.",
  },
  {
    icon: ShieldCheck,
    title: "Portfolio Overview & Risk Tools",
    desc: "After connecting your account, monitor your portfolio and use built-in risk tools to trade with discipline.",
  },
];

const FeaturesSection = () => {
  const { t } = useLanguage();

  return (
    <section id="features" className="relative py-28">
      <div className="absolute inset-0 bg-radial-glow opacity-40" />
      <div className="container relative">
        <ScrollReveal>
          <div className="mx-auto mb-20 max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 text-sm text-secondary-foreground">
              <img src={infinoxLogo} alt="INFINOX" className="h-4 opacity-60" />
              {t("features.powered")}
            </div>
            <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
              {t("features.title1")}{" "}
              <span className="text-gradient">{t("features.title2")}</span>
              <br />
              {t("features.title3")} <span className="text-foreground">{t("features.title4")}</span>
            </h2>
            <p className="mt-5 text-base text-secondary-foreground">
              {t("features.desc")}
            </p>
          </div>
        </ScrollReveal>
        <div className="grid gap-5 sm:grid-cols-2">
          {featurePoints.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 80}>
              <div className="shimmer-border group relative h-full overflow-hidden rounded-2xl glass-panel p-7 transition-all duration-500 hover:-translate-y-1 hover:border-primary/40">
                {/* Subtle chart sparkline accent in the corner */}
                <svg
                  viewBox="0 0 80 24"
                  className="pointer-events-none absolute right-5 top-5 h-6 w-20 opacity-30 transition-opacity duration-500 group-hover:opacity-70"
                  aria-hidden="true"
                >
                  <polyline
                    points="0,18 12,14 22,16 32,8 44,12 56,4 68,10 80,2"
                    fill="none"
                    stroke="hsl(48 100% 60%)"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                <div className="relative z-[1]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-all duration-500 group-hover:bg-primary/20 group-hover:ring-primary/40">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2.5 font-heading text-base font-semibold text-foreground uppercase tracking-wide">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-secondary-foreground">{f.desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
