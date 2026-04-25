import { useMemo } from "react";

/**
 * Sitewide fiery dark ambient background — cohesive with the hero comet.
 * Deep void + warm orange-yellow ember glow + slow drifting embers.
 * Sits below all content (-z-10), fixed to viewport.
 */
const CyberpunkBackground = () => {
  const embers = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 2.5,
        delay: `${Math.random() * 12}s`,
        duration: `${16 + Math.random() * 14}s`,
        // 70% warm orange embers, 30% bright yellow sparks
        warm: i % 3 !== 0,
        opacity: 0.25 + Math.random() * 0.4,
      })),
    []
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "#050505" }}
    >
      {/* Fiery ambient bloom — warm orange top-left, yellow bottom-right */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 55% at 12% 8%, hsl(28 100% 50% / 0.14), transparent 65%),
            radial-gradient(ellipse 60% 50% at 92% 92%, hsl(45 100% 50% / 0.10), transparent 70%),
            radial-gradient(ellipse 50% 40% at 50% 50%, hsl(20 100% 35% / 0.05), transparent 80%)
          `,
        }}
      />

      {/* Drifting embers — warm fiery feel */}
      <div className="absolute inset-0">
        {embers.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float-particle"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.warm
                ? "hsl(28 100% 60%)"
                : "hsl(48 100% 65%)",
              opacity: p.opacity,
              boxShadow: p.warm
                ? `0 0 ${5 + p.size * 2}px hsl(28 100% 50% / 0.7), 0 0 ${10 + p.size * 3}px hsl(20 100% 45% / 0.4)`
                : `0 0 ${5 + p.size * 2}px hsl(48 100% 51% / 0.7)`,
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
            "radial-gradient(ellipse 95% 80% at 50% 50%, transparent 50%, hsl(0 0% 0% / 0.65) 100%)",
        }}
      />
    </div>
  );
};

export default CyberpunkBackground;
