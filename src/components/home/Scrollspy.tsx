import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

export type SpyItem = { id: string; label: string };

/**
 * Sticky in-page navigation with active-section highlight (scrollspy).
 * Anchors must match section ids in the page.
 */
const Scrollspy = ({ items }: { items: SpyItem[] }) => {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visible = new Map<string, number>();

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) visible.set(id, entry.intersectionRatio);
            else visible.delete(id);
          });
          // Pick the section with the largest visible ratio
          let best = "";
          let bestRatio = 0;
          visible.forEach((ratio, key) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = key;
            }
          });
          if (best) setActive(best);
        },
        { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const offset = 96; // navbar + scrollspy bar
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
    track("internal_link_click", { section: "scrollspy", destination: `#${id}`, label: id });
  };

  return (
    <nav
      aria-label="Navegación de secciones"
      className="sticky top-16 sm:top-18 lg:top-20 z-30 w-full border-y border-primary/15 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:px-6 lg:px-8 scrollbar-none">
        {items.map(({ id, label }) => {
          const isActive = active === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => handleClick(e, id)}
              aria-current={isActive ? "true" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(45_100%_50%/0.45)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
              }`}
            >
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
};

export default Scrollspy;
