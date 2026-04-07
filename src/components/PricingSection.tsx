import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";
import { TranslationKey } from "@/i18n/translations";

const PricingSection = () => {
  const { t } = useLanguage();

  const plans: { name: TranslationKey; price: string; period: string; features: TranslationKey[]; highlighted: boolean }[] = [
    {
      name: "pricing.starter",
      price: "$1",
      period: "for 10 days",
      features: ["pricing.starter.f1", "pricing.starter.f2", "pricing.starter.f3", "pricing.starter.f4"],
      highlighted: false,
    },
    {
      name: "pricing.professional",
      price: "$49",
      period: "/month",
      features: ["pricing.pro.f1", "pricing.pro.f2", "pricing.pro.f3", "pricing.pro.f4", "pricing.pro.f5"],
      highlighted: true,
    },
    {
      name: "pricing.enterprise",
      price: "Custom",
      period: "",
      features: ["pricing.enterprise.f1", "pricing.enterprise.f2", "pricing.enterprise.f3", "pricing.enterprise.f4", "pricing.enterprise.f5"],
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-28">
      <div className="absolute inset-0 bg-radial-glow opacity-20" />
      <div className="container relative">
        <ScrollReveal>
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
              {t("pricing.title")} <span className="text-gradient">{t("pricing.title2")}</span>
            </h2>
            <p className="mt-5 text-base text-muted-foreground">
              {t("pricing.desc")}
            </p>
          </div>
        </ScrollReveal>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 100}>
              <div
                className={`rounded-2xl p-8 transition-all duration-500 h-full ${
                  plan.highlighted
                    ? "card-glass ring-1 ring-primary/30 shadow-xl shadow-primary/10 scale-[1.03]"
                    : "card-glass-hover"
                }`}
              >
                {plan.highlighted && (
                  <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                    {t("pricing.popular")}
                  </span>
                )}
                <h3 className="font-heading text-lg font-bold text-foreground uppercase">{t(plan.name)}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-heading text-5xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mt-8 space-y-3.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      {t(f)}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-8 w-full rounded-full h-11 font-semibold ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/80"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {t("pricing.cta")}
                </Button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
