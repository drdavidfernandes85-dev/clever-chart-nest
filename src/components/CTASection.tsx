import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ScrollReveal";

const CTASection = () => (
  <section className="py-28">
    <div className="container">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-20 text-center md:px-16">
          {/* Decorative elements */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(40_95%_60%/0.4),transparent_60%)]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary-foreground/5 blur-3xl" />

          <div className="relative z-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/20 backdrop-blur-sm">
              <Zap className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-heading text-4xl font-bold text-primary-foreground md:text-5xl tracking-tight">
              Ready to Trade with the Pros?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/80">
              Join thousands of traders in the Elite Live Trading Room. Get real-time signals, expert analysis, and a community that helps you win.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 h-13 px-8 text-base font-semibold rounded-xl shadow-xl"
                asChild
              >
                <Link to="/register">
                  Sign Up Now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 font-semibold h-13 px-8 text-base rounded-xl"
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
