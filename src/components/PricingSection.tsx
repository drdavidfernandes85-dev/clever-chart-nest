import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

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
  <section id="pricing" className="py-24">
    <div className="container">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
          Simple, Transparent <span className="text-gradient">Pricing</span>
        </h2>
        <p className="mt-4 text-muted-foreground">
          Start with just $1. Upgrade anytime as your trading grows.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl p-8 transition-all ${
              plan.highlighted
                ? "card-glass glow-border ring-1 ring-primary/30 scale-[1.02]"
                : "card-glass"
            }`}
          >
            {plan.highlighted && (
              <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Most Popular
              </span>
            )}
            <h3 className="font-heading text-xl font-bold text-foreground">{plan.name}</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-bold text-foreground">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className={`mt-8 w-full ${
                plan.highlighted
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Get Started
            </Button>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
