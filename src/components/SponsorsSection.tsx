import sponsorsStrip from "@/assets/sponsors-strip.png";
import ScrollReveal from "@/components/ScrollReveal";

const SponsorsSection = () => {
  return (
    <section className="relative border-y border-border/40 bg-background py-20">
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="container relative">
        <ScrollReveal>
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/60">
            Official Partnerships & Sponsorships
          </p>
          <div className="mx-auto max-w-5xl rounded-2xl border border-border/40 bg-card/30 px-8 py-10 backdrop-blur-sm">
            <img
              src={sponsorsStrip}
              alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
              className="mx-auto w-full object-contain opacity-80 transition-opacity duration-500 hover:opacity-100"
              loading="lazy"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default SponsorsSection;
