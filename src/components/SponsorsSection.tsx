import sponsorsStrip from "@/assets/sponsors-strip.png";
import ScrollReveal from "@/components/ScrollReveal";

const SponsorsSection = () => {
  return (
    <section className="border-y border-border/60 bg-background py-16">
      <div className="container">
        <ScrollReveal>
          <p className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
            Official Partnerships & Sponsorships
          </p>
          <div className="mx-auto max-w-6xl rounded-3xl border border-border/60 bg-card/20 px-6 py-8 shadow-xl backdrop-blur-sm sm:px-10">
            <img
              src={sponsorsStrip}
              alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
              className="mx-auto w-full object-contain brightness-0 invert opacity-85 transition-opacity duration-500 hover:opacity-100"
              loading="lazy"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default SponsorsSection;
