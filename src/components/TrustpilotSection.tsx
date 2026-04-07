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
      <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
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
    <section className="relative bg-background py-24">
      <div className="absolute top-0 left-0 right-0 cyber-line" />
      <div className="container relative">
        <ScrollReveal>
          <div className="mb-14 max-w-2xl">
            <h2 className="font-heading text-4xl font-bold text-foreground uppercase tracking-tight">
              What Our <span className="text-gradient">Client</span>
              <br />
              <span className="text-muted-foreground/50">Says About Us</span>
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <div className="relative">
            {canScrollLeft && (
              <button
                onClick={() => scroll("left")}
                className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-foreground hover:bg-secondary transition-colors lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scroll("right")}
                className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors lg:hidden"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:overflow-visible"
            >
              {reviews.map((r, i) => (
                <div
                  key={i}
                  className="min-w-[260px] snap-start card-glass rounded-2xl p-5 transition-all duration-500 hover:border-primary/20 hover:shadow-primary/5 hover:shadow-xl lg:min-w-0"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.date}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{r.text}</p>
                  <div className="mt-3">
                    <Stars />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default TrustpilotSection;
