import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import heroLaptop from "@/assets/hero-laptop.png";

const HeroSection = () => {
  return (
    <section id="home" className="hero-bg relative overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 bg-radial-glow" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,hsl(45_100%_50%/0.06),transparent_70%)]" />

      <div className="container relative flex min-h-[92vh] flex-col items-center justify-center gap-16 py-20 lg:flex-row">
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-sm text-primary backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-slow" />
            Powered by INFINOX
          </div>

          <h1 className="font-heading text-5xl font-bold leading-[1.1] text-foreground md:text-6xl lg:text-7xl tracking-tight">
            Elite Live{" "}
            <span className="text-gradient">Trading Room</span>
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            Navigate the markets with confidence. Real-time analysis, expert insights,
            and professional trading tools — all in one platform.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-12 px-8 text-base font-semibold rounded-xl shadow-lg shadow-primary/20"
              asChild
            >
              <Link to="/register">
                Sign Up Today <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border/60 bg-secondary/50 text-foreground hover:bg-secondary/80 gap-2 h-12 px-8 text-base rounded-xl backdrop-blur-sm"
              asChild
            >
              <Link to="/login">
                <Play className="h-4 w-4" /> Watch Demo
              </Link>
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex gap-8 pt-4">
            {[
              { value: "5,000+", label: "Active Traders" },
              { value: "24/7", label: "Market Coverage" },
              { value: "4.7★", label: "Trustpilot" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-heading text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 animate-float">
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse,hsl(45_100%_50%/0.08),transparent_70%)]" />
            <img
              src={heroLaptop}
              alt="Elite Live Trading Room platform dashboard"
              className="relative w-full max-w-xl drop-shadow-2xl"
            />
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
