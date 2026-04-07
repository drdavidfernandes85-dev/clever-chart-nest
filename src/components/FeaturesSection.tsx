import { BarChart3, LineChart, Users, MessageSquare, Globe, Video, GraduationCap } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

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
  <section id="features" className="py-24">
    <div className="container">
      <ScrollReveal>
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
            Everything You Need to{" "}
            <span className="text-gradient">Trade Successfully</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Navigate complex markets with professional tools and expert guidance.
          </p>
        </div>
      </ScrollReveal>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <ScrollReveal key={f.title} delay={i * 100}>
            <div className="card-glass group rounded-xl p-6 transition-all hover:glow-border h-full">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 font-heading text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
