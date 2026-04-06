import tottenham from "@/assets/sponsors/tottenham.png";
import teamPhoto from "@/assets/sponsors/team-photo.png";
import porscheCarrera from "@/assets/sponsors/porsche-carrera.png";
import racingCar from "@/assets/sponsors/racing-car.png";
import chestertonsPolo from "@/assets/sponsors/chestertons-polo.png";
import poloAction from "@/assets/sponsors/polo-action.png";
import ScrollReveal from "@/components/ScrollReveal";

const sponsors = [
  { src: tottenham, alt: "Tottenham Hotspur", h: "h-16 sm:h-20", width: 40, height: 96 },
  { src: teamPhoto, alt: "Team celebration", h: "h-16 sm:h-20", width: 143, height: 118 },
  { src: porscheCarrera, alt: "Porsche Carrera Cup Brasil", h: "h-14 sm:h-16", width: 240, height: 90 },
  { src: racingCar, alt: "Infinox Porsche race car", h: "h-14 sm:h-16", width: 290, height: 79 },
  { src: chestertonsPolo, alt: "Chestertons Polo in the Park", h: "h-12 sm:h-14", width: 295, height: 113 },
  { src: poloAction, alt: "Polo action photography", h: "h-16 sm:h-20", width: 202, height: 119 },
];

const SponsorsSection = () => {
  return (
    <section className="border-y border-border/60 bg-background py-16">
      <div className="container">
        <ScrollReveal>
          <p className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
            Official Partnerships & Sponsorships
          </p>
          <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-x-8 gap-y-10 rounded-3xl border border-border/60 bg-card/20 px-8 py-10 shadow-xl backdrop-blur-sm md:grid-cols-3 xl:grid-cols-6 xl:gap-6 xl:px-10">
            {sponsors.map((s) => (
              <div key={s.alt} className="flex items-center justify-center">
                <img
                  src={s.src}
                  alt={s.alt}
                  width={s.width}
                  height={s.height}
                  className={`${s.h} w-auto object-contain opacity-90 transition-opacity duration-500 hover:opacity-100`}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default SponsorsSection;
