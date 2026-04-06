import sponsorsStrip from "@/assets/sponsors-strip.png";

const SponsorsSection = () => {
  return (
    <section className="border-y border-border bg-background py-14">
      <div className="container">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Official Partnerships & Sponsorships
        </p>
        <div className="flex items-center justify-center">
          <img
            src={sponsorsStrip}
            alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
            className="w-full max-w-5xl object-contain invert brightness-0 invert-0 mix-blend-screen"
          />
        </div>
      </div>
    </section>
  );
};

export default SponsorsSection;
