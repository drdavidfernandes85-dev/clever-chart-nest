import { useMemo } from "react";

/**
 * Clean professional dark trading terminal background.
 * Deep void with very subtle yellow brand bloom + minimal floating particles.
 * No grid, no beams, no digital rain — pure focus on data readability.
 */
const CyberpunkBackground = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 2,
        delay: `${Math.random() * 10}s`,
        duration: `${14 + Math.random() * 14}s`,
        color: i % 5 === 0 ? "cyan" : "yellow",
        opacity: 0.2 + Math.random() * 0.35,
      })),
    []
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "#070707" }}
    >
      {/* Subtle ambient bloom — yellow brand top-left, faint cool bottom-right */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 65% 50% at 15% 10%, hsl(48 100% 51% / 0.07), transparent 65%),
            radial-gradient(ellipse 55% 45% at 90% 95%, hsl(220 25% 15% / 0.45), transparent 70%)
          `,
        }}
      />

      {/* Soft floating particles — minimal, slow */}
      <div className="absolute inset-0">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float-particle"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color === "yellow" ? "hsl(48 100% 65%)" : "hsl(187 90% 70%)",
              opacity: p.opacity,
              boxShadow:
                p.color === "yellow"
                  ? `0 0 ${4 + p.size * 2}px hsl(48 100% 51% / 0.65)`
                  : `0 0 ${4 + p.size * 2}px hsl(187 100% 50% / 0.55)`,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 80% at 50% 50%, transparent 55%, hsl(0 0% 0% / 0.55) 100%)",
        }}
      />
    </div>
  );
};

export default CyberpunkBackground;
