import { BarChart3, LineChart, Users, MessageSquare, Globe, Video, GraduationCap } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import { useLanguage } from "@/i18n/LanguageContext";
import { TranslationKey } from "@/i18n/translations";

const featureKeys: { icon: typeof LineChart; title: TranslationKey; desc: TranslationKey }[] = [
  { icon: LineChart, title: "features.realtime", desc: "features.realtime.desc" },
  { icon: Users, title: "features.community", desc: "features.community.desc" },
  { icon: BarChart3, title: "features.charts", desc: "features.charts.desc" },
  { icon: MessageSquare, title: "features.chatroom", desc: "features.chatroom.desc" },
  { icon: Video, title: "features.webinars", desc: "features.webinars.desc" },
  { icon: Globe, title: "features.coverage", desc: "features.coverage.desc" },
  { icon: GraduationCap, title: "features.education", desc: "features.education.desc" },
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featureKeys.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 80}>
              <div className="shimmer-border group relative h-full overflow-hidden rounded-2xl glass-panel p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_hsl(48_100%_51%/0.25)]">
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
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)] transition-all duration-500 group-hover:bg-primary/20 group-hover:shadow-[0_0_24px_hsl(48_100%_51%/0.35)]">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2.5 font-heading text-base font-semibold text-foreground uppercase tracking-wide">
                    {t(f.title)}
                  </h3>
                  <p className="text-sm leading-relaxed text-secondary-foreground">{t(f.desc)}</p>
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
