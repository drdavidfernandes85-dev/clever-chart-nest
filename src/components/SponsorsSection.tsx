import sponsorsStrip from "@/assets/sponsors-strip.png";

const SponsorsSection = () => {
  return (
    <section className="border-y border-border bg-background py-14">
      <div className="container">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Official Partnerships & Sponsorships
        </p>
        <div className="flex items-center justify-center rounded-lg overflow-hidden">
          <div className="relative w-full max-w-5xl bg-background p-6">
            <img
              src={sponsorsStrip}
              alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
              className="w-full object-contain mix-blend-screen"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SponsorsSection;
