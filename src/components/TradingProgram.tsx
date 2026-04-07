import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const benefits = [
  "Receive 75% (or 90% at extra cost) of the profits",
  "We cover your losses",
  "Learn to trade from experts",
  "Be supported by a trading community",
  "1-on-1 onboarding with our President",
];

const TradingProgram = () => (
  <section id="programs" className="relative py-28">
    <div className="absolute inset-0 bg-radial-glow opacity-40" />
    <div className="container relative">
      <ScrollReveal>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="space-y-7">
            <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl tracking-tight">
              DON'T trade your own money.{" "}
              <span className="text-gradient">Trade OURS!</span>
            </h2>
            <ul className="space-y-4">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-muted-foreground">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  {b}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 text-base font-semibold rounded-xl shadow-lg shadow-primary/20"
            >
              Get Started
            </Button>
          </div>
          <div className="card-glass rounded-2xl p-1.5">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-secondary/50">
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-18 w-18 items-center justify-center rounded-2xl bg-primary/20 backdrop-blur-sm">
                    <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">Trader Funding Program</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default TradingProgram;
