import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const MentoringSection = () => (
  <section id="education" className="bg-secondary/30 py-24">
    <div className="container">
      <ScrollReveal>
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
            One-on-One <span className="text-gradient">Mentoring</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Get personalized coaching from our expert traders.
          </p>
          <Button size="lg" className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <a href="mailto:ventas@infinox.com?subject=Book%20a%20Mentoring%20Session">
              Book a Session
            </a>
          </Button>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default MentoringSection;
