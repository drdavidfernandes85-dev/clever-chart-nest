import tottenham from "@/assets/sponsors/tottenham.png";
import poloPlayers from "@/assets/sponsors/polo-players.png";
import porscheCarrera from "@/assets/sponsors/porsche-carrera.png";
import racingCar from "@/assets/sponsors/racing-car.png";
import chestertonsPool from "@/assets/sponsors/chestertons-polo.png";
import poloAction from "@/assets/sponsors/polo-action.png";
import ScrollReveal from "@/components/ScrollReveal";

const sponsors = [
  { src: tottenham, alt: "Tottenham Hotspur", h: "h-14 sm:h-16" },
  { src: poloPlayers, alt: "Polo Championship", h: "h-14 sm:h-16" },
  { src: porscheCarrera, alt: "Porsche Carrera Cup Brasil", h: "h-14 sm:h-16" },
  { src: racingCar, alt: "Porsche Racing Car", h: "h-10 sm:h-12" },
  { src: chestertonsPool, alt: "Chestertons Polo in the Park", h: "h-10 sm:h-12" },
  { src: poloAction, alt: "Polo Sport", h: "h-14 sm:h-16" },
];

const SponsorsSection = () => {
  return (
    <section className="border-y border-border/60 bg-background py-16">
      <div className="container">
        <ScrollReveal>
          <p className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
            Official Partnerships & Sponsorships
          </p>
          <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-8 rounded-3xl border border-border/60 bg-card/20 px-8 py-10 shadow-xl backdrop-blur-sm sm:grid-cols-6 sm:gap-6 sm:px-10">
            {sponsors.map((s) => (
              <div key={s.alt} className="flex items-center justify-center">
                <img
                  src={s.src}
                  alt={s.alt}
                  className={`${s.h} w-auto object-contain brightness-0 invert opacity-70 transition-opacity duration-500 hover:opacity-100`}
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
