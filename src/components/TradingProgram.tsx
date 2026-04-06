import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const benefits = [
  "Receive 75% (or 90% at extra cost) of the profits",
  "We cover your losses",
  "Learn to trade from experts",
  "Be supported by a trading community",
  "1-on-1 onboarding with our President",
];

const TradingProgram = () => (
  <section id="programs" className="py-24">
    <div className="container">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
            DON'T trade your own money.{" "}
            <span className="text-gradient">Trade OURS!</span>
          </h2>
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 text-muted-foreground">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                {b}
              </li>
            ))}
          </ul>
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
            Get Started
          </Button>
        </div>
        <div className="card-glass rounded-xl p-1">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-secondary">
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
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
    </div>
  </section>
);

export default TradingProgram;
