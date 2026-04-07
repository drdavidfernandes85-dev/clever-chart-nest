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
          <div className="relative overflow-hidden rounded-3xl bg-card border border-border/30 px-6 py-20 text-center md:px-16">
            <div className="absolute inset-0 bg-grid-pattern opacity-10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(0_85%_50%/0.08),transparent_70%)]" />
            <div className="absolute top-0 left-0 right-0 cyber-line" />
            <div className="absolute bottom-0 left-0 right-0 cyber-line" />

            <div className="relative z-10">
              <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
                {t("cta.title1")} <span className="text-gradient">{t("cta.title2")}</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
                {t("cta.desc")}
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/80 gap-2 h-12 px-8 text-sm font-semibold rounded-full"
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
