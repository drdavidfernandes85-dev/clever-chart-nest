import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ScrollReveal";

const CTASection = () => (
  <section className="py-28">
    <div className="container">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-3xl bg-card border border-border/30 px-6 py-20 text-center md:px-16">
          {/* Background effects */}
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(0_85%_50%/0.08),transparent_70%)]" />
          <div className="absolute top-0 left-0 right-0 cyber-line" />
          <div className="absolute bottom-0 left-0 right-0 cyber-line" />

          <div className="relative z-10">
            <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
              Ready to <span className="text-gradient">Trade</span>
              <br />
              <span className="text-muted-foreground/50">With the Pros?</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
              Join thousands of traders in the Elite Live Trading Room. Get real-time signals, expert analysis, and a community that helps you win.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/80 gap-2 h-12 px-8 text-sm font-semibold rounded-full"
                asChild
              >
                <Link to="/register">
                  Sign Up Now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border bg-transparent text-foreground hover:bg-secondary font-semibold h-12 px-8 text-sm rounded-full"
                asChild
              >
                <Link to="/login">Log In</Link>
              </Button>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default CTASection;
