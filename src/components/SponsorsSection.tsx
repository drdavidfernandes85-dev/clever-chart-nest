import sponsorsStrip from "@/assets/sponsors-strip.png";

const SponsorsSection = () => {
  return (
    <section className="border-y border-border bg-card py-10">
      <div className="container">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Trusted by leading brands worldwide
        </p>
        <div className="flex items-center justify-center">
          <img
            src={sponsorsStrip}
            alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
            className="max-h-20 w-full max-w-4xl object-contain opacity-80 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500"
          />
        </div>
      </div>
    </section>
  );
};

export default SponsorsSection;
