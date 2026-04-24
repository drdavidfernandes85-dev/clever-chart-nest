import { useMemo } from "react";

/**
 * Premium crypto ambient background — NO GRID.
 *
 * Layers (bottom → top):
 *  1. Pure void #020202 base
 *  2. Atmospheric radial bloom (yellow primary + cyan secondary)
 *  3. Soft floating particles (firefly-style, yellow + cyan)
 *  4. 4 soft animated vertical light beams
 *  5. Vignette to focus the eye on content
 *
 * Non-interactive · respects `prefers-reduced-motion`.
 */
const CyberpunkBackground = () => {
  // Pre-computed floating particles (firefly-style, no grid)
  const particles = useMemo(
    () =>
      Array.from({ length: 38 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 1 + Math.random() * 3,
        delay: `${Math.random() * 8}s`,
        duration: `${10 + Math.random() * 16}s`,
        color: i % 4 === 0 ? "cyan" : "yellow",
        opacity: 0.3 + Math.random() * 0.5,
      })),
    []
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "#020202" }}
    >
      {/* Atmospheric radial bloom — yellow dominant + soft cyan */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 50% at 18% 12%, hsl(48 100% 51% / 0.14), transparent 65%),
            radial-gradient(ellipse 60% 45% at 88% 90%, hsl(187 100% 50% / 0.10), transparent 65%),
            radial-gradient(ellipse 50% 35% at 50% 100%, hsl(48 100% 51% / 0.08), transparent 70%),
            radial-gradient(ellipse 40% 30% at 50% 50%, hsl(48 100% 51% / 0.04), transparent 75%)
          `,
        }}
      />

      {/* Subtle volumetric light beam from upper-left */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            "conic-gradient(from 220deg at 15% 0%, transparent 0deg, hsl(48 100% 51% / 0.07) 12deg, transparent 30deg)",
          filter: "blur(28px)",
        }}
      />

      {/* Floating firefly particles */}
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
              backgroundColor: p.color === "yellow" ? "hsl(48 100% 65%)" : "hsl(187 100% 70%)",
              opacity: p.opacity,
              boxShadow:
                p.color === "yellow"
                  ? `0 0 ${4 + p.size * 2}px hsl(48 100% 51% / 0.85), 0 0 ${10 + p.size * 4}px hsl(48 100% 51% / 0.45)`
                  : `0 0 ${4 + p.size * 2}px hsl(187 100% 50% / 0.75), 0 0 ${10 + p.size * 4}px hsl(187 100% 50% / 0.35)`,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Vertical soft light beams (no grid) */}
      <div className="absolute inset-0">
        <div className="cyber-beam cyber-beam-1" />
        <div className="cyber-beam cyber-beam-2" />
        <div className="cyber-beam cyber-beam-3" />
        <div className="cyber-beam cyber-beam-4" />
      </div>

      {/* Center bloom for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 45% at 50% 55%, hsl(48 100% 51% / 0.04), transparent 70%)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 75% at 50% 50%, transparent 50%, hsl(0 0% 0% / 0.7) 100%)",
        }}
      />
    </div>
  );
};

export default CyberpunkBackground;
