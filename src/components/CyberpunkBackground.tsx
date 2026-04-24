import { useMemo } from "react";

/**
 * Global ambient cyberpunk background.
 * Layers (bottom → top):
 *  1. Pure #050505 base
 *  2. Radial atmospheric glows (yellow + cyan)
 *  3. Perspective neon grid (CSS, GPU-cheap)
 *  4. Faint horizontal holographic lines
 *  5. Soft vertical light beams (slow drift)
 *  6. Subtle digital-rain glyph columns (very low opacity)
 *
 * All layers are non-interactive (`pointer-events: none`) and respect
 * `prefers-reduced-motion`.
 */
const CyberpunkBackground = () => {
  // Pre-computed digital rain columns so we don't re-randomise on each render
  const rainColumns = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i / 14) * 100 + Math.random() * 4}%`,
        delay: `${Math.random() * 8}s`,
        duration: `${10 + Math.random() * 12}s`,
        chars: Array.from({ length: 22 }, () =>
          Math.random() > 0.5 ? "01"[Math.floor(Math.random() * 2)] : "—|/\\".charAt(Math.floor(Math.random() * 4))
        ).join(" "),
      })),
    []
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "#050505" }}
    >
      {/* Atmospheric radial glows */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 45% at 18% 8%, hsl(48 100% 51% / 0.10), transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 92%, hsl(180 100% 50% / 0.09), transparent 60%),
            radial-gradient(ellipse 40% 30% at 50% 50%, hsl(280 80% 50% / 0.04), transparent 70%)
          `,
        }}
      />

      {/* Perspective neon grid */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(48 100% 51% / 0.06) 1px, transparent 1px),
            linear-gradient(90deg, hsl(180 100% 50% / 0.06) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px, 56px 56px",
          maskImage:
            "radial-gradient(ellipse 100% 80% at 50% 50%, black 30%, transparent 95%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 80% at 50% 50%, black 30%, transparent 95%)",
        }}
      />

      {/* Faint horizontal holographic scan lines (full bleed, ultra subtle) */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, hsl(180 100% 50% / 0.025) 0px, hsl(180 100% 50% / 0.025) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* Soft vertical light beams */}
      <div className="absolute inset-0">
        <div className="cyber-beam cyber-beam-1" />
        <div className="cyber-beam cyber-beam-2" />
        <div className="cyber-beam cyber-beam-3" />
      </div>

      {/* Digital rain — low-opacity glyph columns drifting downward */}
      <div className="absolute inset-0">
        {rainColumns.map((c, i) => (
          <div
            key={i}
            className="absolute top-0 font-mono text-[10px] leading-[14px] text-[hsl(145_100%_55%)] cyber-rain"
            style={{
              left: c.left,
              animationDelay: c.delay,
              animationDuration: c.duration,
              writingMode: "vertical-rl",
              textOrientation: "upright",
              opacity: 0.12,
              textShadow: "0 0 6px hsl(145 100% 55% / 0.6)",
            }}
          >
            {c.chars}
          </div>
        ))}
      </div>

      {/* Vignette to push the eye toward content */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, hsl(0 0% 0% / 0.55) 100%)",
        }}
      />
    </div>
  );
};

export default CyberpunkBackground;
