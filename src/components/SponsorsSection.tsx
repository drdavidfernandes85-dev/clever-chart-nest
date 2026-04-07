import sponsorsStrip from "@/assets/sponsors-strip.png";
import ScrollReveal from "@/components/ScrollReveal";

const SponsorsSection = () => {
  return (
    <section className="relative border-y border-border/30 py-16">
      <div className="container relative">
        <ScrollReveal>
          <p className="mb-8 text-center text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground/50">
            Official Partnerships & Sponsorships
          </p>
          <div className="mx-auto max-w-5xl">
            <img
              src={sponsorsStrip}
              alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
              className="mx-auto w-full object-contain opacity-50 transition-opacity duration-500 hover:opacity-80"
              loading="lazy"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default SponsorsSection;
