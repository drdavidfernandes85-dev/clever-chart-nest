import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import heroLaptop from "@/assets/hero-laptop.png";

const HeroSection = () => {
  return (
    <section id="home" className="hero-bg relative overflow-hidden pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(45_100%_50%/0.08),transparent_60%)]" />
      <div className="container relative flex min-h-[90vh] flex-col items-center justify-center gap-12 py-20 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-slow" />
            Powered by INFINOX
          </div>
          <h1 className="font-heading text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
            Elite Live{" "}
            <span className="text-gradient">Trading Room</span>
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            Navigate the markets with confidence. Real-time analysis, expert insights,
            and professional trading tools — all in one platform.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              Sign Up Today <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 border-border text-foreground hover:bg-secondary">
              <Play className="h-4 w-4" /> Watch Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            GET YOUR FIRST 10 DAYS{" "}
            <span className="font-semibold text-primary">FOR ONLY $1.00</span>
          </p>
        </div>
        <div className="flex-1 animate-float">
          <img
            src={heroLaptop}
            alt="Elite Live Trading Room platform dashboard"
            className="w-full max-w-xl drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
