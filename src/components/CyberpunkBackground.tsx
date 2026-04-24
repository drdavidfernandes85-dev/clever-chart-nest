import { useMemo } from "react";

/**
 * Crypto blockchain ambient background.
 *
 * Layers (bottom → top):
 *  1. Pure void #020202 base
 *  2. Atmospheric radial bloom (cyan + purple)
 *  3. Subtle blockchain neon grid — cyan h-lines + purple v-lines
 *  4. Distant horizon glow lines (cyan + purple)
 *  5. Faint horizontal holographic scan lines
 *  6. Network nodes (faint glowing dots connected by faint lines)
 *  7. 4 soft animated vertical light beams (cyan + purple)
 *  8. Digital rain — hex glyphs (faint)
 *  9. Vignette to focus the eye on content
 *
 * Non-interactive · respects `prefers-reduced-motion`.
 */
const CyberpunkBackground = () => {
  // Pre-computed digital rain columns (hex chars for crypto vibe)
  const rainColumns = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i / 14) * 100 + Math.random() * 3}%`,
        delay: `${Math.random() * 8}s`,
        duration: `${12 + Math.random() * 14}s`,
        chars: Array.from({ length: 22 }, () => {
          const set = "0123456789ABCDEF";
          return set.charAt(Math.floor(Math.random() * set.length));
        }).join(" "),
      })),
    []
  );

  // Pre-computed network nodes
  const nodes = useMemo(() => {
    const arr = Array.from({ length: 14 }, () => ({
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      r: 1.5 + Math.random() * 2,
      delay: Math.random() * 6,
    }));
    // Build edges between nearest neighbors
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number; o: number }> = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const dx = arr[i].x - arr[j].x;
        const dy = arr[i].y - arr[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 22) {
          edges.push({
            x1: arr[i].x,
            y1: arr[i].y,
            x2: arr[j].x,
            y2: arr[j].y,
            o: 0.18 - d / 200,
          });
        }
      }
    }
    return { nodes: arr, edges };
  }, []);

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
            radial-gradient(ellipse 70% 45% at 18% 8%, hsl(187 100% 50% / 0.15), transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 92%, hsl(271 91% 65% / 0.14), transparent 60%),
            radial-gradient(ellipse 40% 30% at 50% 50%, hsl(187 100% 50% / 0.05), transparent 70%)
          `,
        }}
      />

      {/* Blockchain grid — cyan horizontals + purple verticals + fine sub-grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(187 100% 50% / 0.32) 1.25px, transparent 1.25px),
            linear-gradient(90deg, hsl(271 91% 65% / 0.28) 1.25px, transparent 1.25px),
            linear-gradient(hsl(187 100% 50% / 0.10) 1px, transparent 1px),
            linear-gradient(90deg, hsl(271 91% 65% / 0.10) 1px, transparent 1px)
          `,
          backgroundSize: "180px 180px, 180px 180px, 36px 36px, 36px 36px",
          maskImage:
            "radial-gradient(ellipse 100% 90% at 50% 50%, black 25%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 90% at 50% 50%, black 25%, transparent 100%)",
          filter: "drop-shadow(0 0 1px hsl(187 100% 50% / 0.5))",
        }}
      />

      {/* Bloom layer */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(hsl(187 100% 50% / 0.20) 2px, transparent 2px),
            linear-gradient(90deg, hsl(271 91% 65% / 0.18) 2px, transparent 2px)
          `,
          backgroundSize: "180px 180px, 180px 180px",
          filter: "blur(3px)",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 90%)",
        }}
      />

      {/* Center neon bloom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 55%, hsl(187 100% 50% / 0.08), transparent 70%)",
        }}
      />

      {/* Distant horizon neon lines */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          top: "62%",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(187 100% 50% / 0.7) 50%, transparent 100%)",
          boxShadow:
            "0 0 24px hsl(187 100% 50% / 0.6), 0 0 60px hsl(187 100% 50% / 0.35)",
        }}
      />
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          top: "38%",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(271 91% 65% / 0.55) 50%, transparent 100%)",
          boxShadow:
            "0 0 18px hsl(271 91% 65% / 0.5), 0 0 48px hsl(271 91% 65% / 0.28)",
        }}
      />

      {/* Holographic scan lines */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, hsl(187 100% 50% / 0.04) 0px, hsl(187 100% 50% / 0.04) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* Network nodes (blockchain) */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ opacity: 0.55 }}
      >
        {nodes.edges.map((e, i) => (
          <line
            key={`e-${i}`}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="hsl(187 100% 50%)"
            strokeWidth="0.08"
            opacity={Math.max(0.05, e.o)}
          />
        ))}
        {nodes.nodes.map((n, i) => (
          <g key={`n-${i}`} style={{ animation: `hex-pulse 8s ease-in-out infinite`, animationDelay: `${n.delay}s`, transformOrigin: `${n.x}% ${n.y}%` }}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r * 0.35}
              fill="hsl(187 100% 60%)"
              opacity="0.75"
              style={{ filter: "drop-shadow(0 0 1.2px hsl(187 100% 50% / 0.9))" }}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r * 0.9}
              fill="none"
              stroke="hsl(271 91% 70%)"
              strokeWidth="0.06"
              opacity="0.5"
            />
          </g>
        ))}
      </svg>

      {/* Vertical light beams */}
      <div className="absolute inset-0">
        <div className="cyber-beam cyber-beam-1" />
        <div className="cyber-beam cyber-beam-2" />
        <div className="cyber-beam cyber-beam-3" />
        <div className="cyber-beam cyber-beam-4" />
      </div>

      {/* Digital rain — hex glyphs */}
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
              color: i % 3 === 0 ? "hsl(271 91% 70%)" : "hsl(187 100% 65%)",
              opacity: 0.13,
              textShadow:
                i % 3 === 0
                  ? "0 0 6px hsl(271 91% 65% / 0.7)"
                  : "0 0 6px hsl(187 100% 50% / 0.7)",
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
            "radial-gradient(ellipse 90% 70% at 50% 50%, transparent 45%, hsl(0 0% 0% / 0.55) 100%)",
        }}
      />
    </div>
  );
};

export default CyberpunkBackground;
