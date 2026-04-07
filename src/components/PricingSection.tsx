import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const plans = [
  {
    name: "Starter",
    price: "$1",
    period: "for 10 days",
    features: ["Real-time market analysis", "Basic charting tools", "Community access", "Daily newsletter"],
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$49",
    period: "/month",
    features: ["Everything in Starter", "Advanced charts & signals", "1-on-1 mentoring session", "Priority support", "Trading webinars"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: ["Everything in Professional", "Broker dealer solutions", "Custom API access", "Dedicated account manager", "White-label options"],
    highlighted: false,
  },
];

const PricingSection = () => (
  <section id="pricing" className="relative py-28">
    <div className="absolute inset-0 bg-radial-glow opacity-20" />
    <div className="container relative">
      <ScrollReveal>
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
            Simple <span className="text-gradient">Pricing</span>
          </h2>
          <p className="mt-5 text-base text-muted-foreground">
            Start with just $1. Upgrade anytime as your trading grows.
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
                  Most Popular
                </span>
              )}
              <h3 className="font-heading text-lg font-bold text-foreground uppercase">{plan.name}</h3>
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
                    {f}
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
                Get Started
              </Button>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
