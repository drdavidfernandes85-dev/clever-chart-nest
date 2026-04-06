import sponsorsStrip from "@/assets/sponsors-strip.png";
import ScrollReveal from "@/components/ScrollReveal";

const SponsorsSection = () => {
  return (
    <section className="border-y border-border bg-background py-14">
      <div className="container">
        <ScrollReveal>
          <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Official Partnerships & Sponsorships
          </p>
          <div className="flex items-center justify-center">
            <img
              src={sponsorsStrip}
              alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
              className="w-full max-w-5xl object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity duration-500"
              loading="lazy"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default SponsorsSection;
