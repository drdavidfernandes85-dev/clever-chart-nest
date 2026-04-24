import { useMemo } from "react";

/**
 * TRON-inspired ambient cyberpunk background.
 *
 * Layers (bottom → top):
 *  1. Pure void #020202 base
 *  2. Atmospheric radial bloom (yellow + cyan + violet)
 *  3. PROMINENT TRON neon grid — yellow (h-lines) + cyan (v-lines), with center bloom
 *  4. Distant horizon glow (single bright neon line)
 *  5. Faint horizontal holographic scan lines
 *  6. 4 soft animated vertical light beams (yellow + cyan)
 *  7. Digital rain glyph columns (low opacity)
 *  8. Vignette to focus the eye on content
 *
 * All layers are non-interactive and respect `prefers-reduced-motion`.
 */
const CyberpunkBackground = () => {
  // Pre-computed digital rain columns
  const rainColumns = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${(i / 16) * 100 + Math.random() * 3}%`,
        delay: `${Math.random() * 8}s`,
        duration: `${10 + Math.random() * 12}s`,
        chars: Array.from({ length: 24 }, () =>
          Math.random() > 0.5
            ? "01"[Math.floor(Math.random() * 2)]
            : "—|/\\".charAt(Math.floor(Math.random() * 4))
        ).join(" "),
      })),
    []
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "#020202" }}
    >
      {/* Atmospheric radial bloom */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 45% at 18% 8%, hsl(48 100% 51% / 0.16), transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 92%, hsl(180 100% 50% / 0.16), transparent 60%),
            radial-gradient(ellipse 40% 30% at 50% 50%, hsl(280 80% 50% / 0.06), transparent 70%)
          `,
        }}
      />

      {/* TRON grid — heavy yellow horizontals + cyan verticals, with bright center bloom */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(48 100% 51% / 0.55) 1.5px, transparent 1.5px),
            linear-gradient(90deg, hsl(180 100% 55% / 0.45) 1.5px, transparent 1.5px),
            linear-gradient(hsl(48 100% 51% / 0.18) 1px, transparent 1px),
            linear-gradient(90deg, hsl(180 100% 55% / 0.16) 1px, transparent 1px)
          `,
          backgroundSize: "200px 200px, 200px 200px, 40px 40px, 40px 40px",
          maskImage:
            "radial-gradient(ellipse 100% 90% at 50% 50%, black 25%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 90% at 50% 50%, black 25%, transparent 100%)",
          filter: "drop-shadow(0 0 1px hsl(48 100% 51% / 0.6))",
        }}
      />

      {/* Secondary glow grid layer for bloom intensity */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `
            linear-gradient(hsl(48 100% 51% / 0.3) 2px, transparent 2px),
            linear-gradient(90deg, hsl(180 100% 55% / 0.25) 2px, transparent 2px)
          `,
          backgroundSize: "200px 200px, 200px 200px",
          filter: "blur(3px)",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 90%)",
        }}
      />

      {/* Center neon bloom over the grid */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 55%, hsl(48 100% 51% / 0.10), transparent 70%)",
        }}
      />

      {/* Distant horizon neon line */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          top: "62%",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(48 100% 51% / 0.7) 50%, transparent 100%)",
          boxShadow:
            "0 0 24px hsl(48 100% 51% / 0.6), 0 0 60px hsl(48 100% 51% / 0.35)",
        }}
      />
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          top: "38%",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(180 100% 55% / 0.5) 50%, transparent 100%)",
          boxShadow:
            "0 0 18px hsl(180 100% 55% / 0.5), 0 0 48px hsl(180 100% 55% / 0.25)",
        }}
      />

      {/* Faint horizontal holographic scan lines */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, hsl(180 100% 50% / 0.04) 0px, hsl(180 100% 50% / 0.04) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* Vertical light beams */}
      <div className="absolute inset-0">
        <div className="cyber-beam cyber-beam-1" />
        <div className="cyber-beam cyber-beam-2" />
        <div className="cyber-beam cyber-beam-3" />
        <div className="cyber-beam cyber-beam-4" />
      </div>

      {/* Digital rain */}
      <div className="absolute inset-0">
        {rainColumns.map((c, i) => (
          <div
            key={i}
            className="absolute top-0 font-mono text-[10px] leading-[14px] cyber-rain"
            style={{
              left: c.left,
              animationDelay: c.delay,
              animationDuration: c.duration,
              writingMode: "vertical-rl",
              textOrientation: "upright",
              color: i % 3 === 0 ? "hsl(48 100% 60%)" : "hsl(180 100% 65%)",
              opacity: 0.14,
              textShadow:
                i % 3 === 0
                  ? "0 0 6px hsl(48 100% 51% / 0.7)"
                  : "0 0 6px hsl(180 100% 55% / 0.7)",
            }}
          >
            {c.chars}
          </div>
        ))}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 35%, hsl(0 0% 0% / 0.65) 100%)",
        }}
      />
    </div>
  );
};

export default CyberpunkBackground;
