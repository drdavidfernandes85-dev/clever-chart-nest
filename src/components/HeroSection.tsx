import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroLaptop from "@/assets/hero-laptop.png";

const HeroSection = () => {
  return (
    <section id="home" className="hero-bg relative overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="absolute inset-0 bg-radial-glow" />
      {/* Red accent line at top */}
      <div className="absolute top-16 left-0 right-0 cyber-line" />

      <div className="container relative flex min-h-[92vh] flex-col items-center justify-center gap-16 py-20 lg:flex-row">
        <div className="flex-1 space-y-8">
          {/* Overline */}
          <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-slow" />
            Powered by INFINOX
          </div>

          {/* Heading with partial gradient */}
          <h1 className="font-heading text-5xl font-bold leading-[1.05] text-foreground md:text-6xl lg:text-7xl uppercase tracking-tight">
            Elite Live
            <br />
            <span className="text-gradient">Trading</span>{" "}
            <span className="text-muted-foreground/60">Room</span>
          </h1>

          <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
            Navigate the markets with confidence. Real-time analysis, expert insights,
            and professional trading tools — all in one platform.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/80 gap-2 h-12 px-8 text-sm font-semibold rounded-full"
              asChild
            >
              <Link to="/register">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border bg-transparent text-foreground hover:bg-secondary gap-2 h-12 px-8 text-sm rounded-full"
              asChild
            >
              <Link to="/login">
                Watch Demo
              </Link>
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex gap-10 pt-6">
            {[
              { value: "75%", label: "Win Rate" },
              { value: "99.8%", label: "Uptime" },
              { value: "5K+", label: "Traders" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-heading text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 animate-float">
          <div className="relative">
            {/* Red glow behind image */}
            <div className="absolute -inset-8 rounded-3xl bg-[radial-gradient(ellipse,hsl(0_85%_50%/0.1),transparent_70%)]" />
            <img
              src={heroLaptop}
              alt="Elite Live Trading Room platform dashboard"
              className="relative w-full max-w-xl drop-shadow-2xl"
            />
          </div>
        </div>
      </div>

      {/* Bottom cyber line */}
      <div className="absolute bottom-0 left-0 right-0 cyber-line" />
    </section>
  );
};

export default HeroSection;
