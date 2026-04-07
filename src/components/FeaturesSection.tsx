import { BarChart3, LineChart, Users, MessageSquare, Globe, Video, GraduationCap } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import infinoxLogo from "@/assets/infinox-logo-white.png";

const features = [
  {
    icon: LineChart,
    title: "Real-Time Analysis",
    description: "Live market analysis across FX, commodities, stocks, and crypto markets.",
  },
  {
    icon: Users,
    title: "Expert Community",
    description: "Join a thriving community of professional traders and analysts.",
  },
  {
    icon: BarChart3,
    title: "Advanced Charts",
    description: "Professional-grade charting tools with technical indicators and overlays.",
  },
  {
    icon: MessageSquare,
    title: "Chatroom",
    description: "Chat and discuss markets 24/7 with fellow traders and our expert team members.",
  },
  {
    icon: Video,
    title: "Daily Webinars",
    description: "Daily webinars hosted by seasoned veterans with live market analysis and Q&A.",
  },
  {
    icon: Globe,
    title: "24/7 Coverage",
    description: "Round-the-clock market coverage across all major trading sessions.",
  },
  {
    icon: GraduationCap,
    title: "Education",
    description: "Comprehensive trading courses and resources to sharpen your skills at every level.",
  },
];

const FeaturesSection = () => (
  <section id="features" className="relative py-28">
    <div className="absolute inset-0 bg-radial-glow opacity-50" />
    <div className="container relative">
      <ScrollReveal>
        <div className="mx-auto mb-20 max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-sm text-primary backdrop-blur-sm">
            <img src={infinoxLogo} alt="INFINOX" className="h-4" />
            Powered by INFINOX
          </div>
          <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl tracking-tight">
            Everything You Need to{" "}
            <span className="text-gradient">Trade Successfully</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Navigate complex markets with professional tools and expert guidance.
          </p>
        </div>
      </ScrollReveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <ScrollReveal key={f.title} delay={i * 80}>
            <div className="card-glass-hover group rounded-2xl p-7 h-full">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/10">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2.5 font-heading text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
