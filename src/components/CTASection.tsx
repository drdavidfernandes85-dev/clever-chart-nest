import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ScrollReveal";

const CTASection = () => (
  <section className="py-24">
    <div className="container">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center md:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(40_95%_55%/0.4),transparent_60%)]" />
          <div className="relative z-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-foreground/20">
              <Zap className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-primary-foreground md:text-4xl">
              Ready to Trade with the Pros?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
              Join thousands of traders in the Elite Live Trading Room. Get real-time signals, expert analysis, and a community that helps you win.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2"
                asChild
              >
                <Link to="/register">
                  Sign Up Now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
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
