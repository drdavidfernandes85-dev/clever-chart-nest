import luisArias from "@/assets/luis-arias.png";
import ScrollReveal from "@/components/ScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";

const TeamSection = () => {
  const { t } = useLanguage();

  return (
    <section id="team" className="relative py-28">
      <div className="absolute inset-0 bg-radial-glow opacity-30" />
      <div className="container relative">
        <ScrollReveal>
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
              {t("team.title1")} <span className="text-gradient">{t("team.title2")}</span>
              <br />
              <span className="text-muted-foreground/50">{t("team.title3")}</span>
            </h2>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <div className="mx-auto max-w-sm">
            <div className="card-glass-hover group rounded-2xl p-10 text-center">
              <div className="relative mx-auto mb-6 h-36 w-36">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 to-transparent blur-sm group-hover:from-primary/50 transition-all duration-500" />
                <img
                  src={luisArias}
                  alt="Luis Arias"
                  className="relative h-full w-full rounded-full object-cover"
                />
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary border-2 border-card" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground">
                Luis Arias
              </h3>
              <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
                {t("team.role")}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default TeamSection;
