import { useRef, useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

const reviews = [
  { name: "Arnaldo Tsukamoto", date: "23 March", title: "Great experience with the broker…", text: "Great experience and TOP service by Gabriel Chiqueti." },
  { name: "Arnaldo Tsukamoto", date: "20 March", title: "Broker with fast payment and execution…", text: "Broker with fast payment and execution, account manager Gabriel Chiqueti very attentive…" },
  { name: "Marcio Pereira", date: "20 March", title: "Very good experience, first-class…", text: "Very good experience, first-class customer service." },
  { name: "juarez pereira", date: "20 March", title: "Speed and trust", text: "Speed and trust. The broker inspires confidence and delivers fast solutions…" },
  { name: "Nilson Vieira", date: "20 March", title: "Speed and efficiency", text: "Speed and efficiency" },
];

const Stars = () => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex h-5 w-5 items-center justify-center rounded-sm bg-emerald-500">
        <Star className="h-3 w-3 fill-foreground text-foreground" />
      </div>
    ))}
  </div>
);

const TrustpilotSection = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener("scroll", checkScroll, { passive: true });
    return () => el?.removeEventListener("scroll", checkScroll);
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section className="relative bg-background py-20">
      <div className="absolute inset-0 bg-secondary/10" />
      <div className="container relative">
        <ScrollReveal>
          <h2 className="mb-12 text-center font-heading text-4xl font-bold text-foreground tracking-tight">
            What Our Clients Say
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="relative">
            {canScrollLeft && (
              <button
                onClick={() => scroll("left")}
                className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border/50 shadow-lg text-foreground hover:bg-secondary transition-colors lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scroll("right")}
                className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border/50 shadow-lg text-foreground hover:bg-secondary transition-colors lg:hidden"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:overflow-visible"
            >
              {reviews.map((r, i) => (
                <div
                  key={i}
                  className="min-w-[260px] snap-start rounded-2xl border border-border/30 bg-card/60 p-5 backdrop-blur-sm shadow-lg shadow-background/30 transition-all duration-300 hover:border-primary/20 hover:shadow-primary/5 hover:shadow-xl lg:min-w-0"
                >
                  <Stars />
                  <h3 className="mt-3 text-sm font-semibold text-foreground line-clamp-1">{r.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{r.text}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{r.name}</span>, {r.date}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">
            Rated <span className="font-semibold text-foreground">4.7 / 5</span> | based on{" "}
            <a href="https://www.trustpilot.com" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors">
              1,142 reviews
            </a>
            . Our 4 & 5 star reviews.
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <Star className="h-4 w-4 fill-emerald-500 text-emerald-500" />
            <span className="text-sm font-semibold text-foreground">Trustpilot</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustpilotSection;
