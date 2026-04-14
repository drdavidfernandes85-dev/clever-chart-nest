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
              <div className="card-glass-hover group rounded-2xl p-7 h-full">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/10">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2.5 font-heading text-base font-semibold text-foreground uppercase tracking-wide">
                  {t(f.title)}
                </h3>
                <p className="text-sm leading-relaxed text-secondary-foreground">{t(f.desc)}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
