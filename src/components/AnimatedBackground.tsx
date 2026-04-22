import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

/**
 * Neural Lattice background — sitewide.
 * Magnetic field grid + sparking gold synapse nodes + tracing connection lines.
 * Pure CSS/SVG, no images. Drifts slowly so it feels alive without distracting.
 */

type Node = { top: number; left: number; size: number; delay: number; dur: number; bright: boolean };
type Line = { top: number; left: number; width: number; rotate: number; delay: number; dur: number };

const seedRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const AnimatedBackground = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Stable per-mount layout (deterministic so it doesn't reflow on theme switch)
  const { nodes, lines, dust } = useMemo(() => {
    const r = seedRand(42);
    const nodes: Node[] = Array.from({ length: 26 }, () => ({
      top: r() * 100,
      left: r() * 100,
      size: 2 + Math.floor(r() * 6),
      delay: r() * 4,
      dur: 3 + r() * 5,
      bright: r() > 0.55,
    }));
    const lines: Line[] = Array.from({ length: 14 }, () => ({
      top: r() * 100,
      left: r() * 100,
      width: 6 + r() * 18,
      rotate: r() * 360,
      delay: r() * 3,
      dur: 2.5 + r() * 4,
    }));
    const dust = Array.from({ length: 10 }, () => ({
      top: r() * 100,
      left: r() * 100,
      delay: r() * 5,
    }));
    return { nodes, lines, dust };
  }, []);

  const goldCore = "hsl(48 90% 70%)";
  const goldDust = "hsl(45 45% 50%)";
  const trace = isDark ? "rgba(166,144,90,0.18)" : "rgba(140,110,40,0.22)";

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Deep base */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 100% 80% at 50% 30%, hsl(0 0% 8%) 0%, hsl(0 0% 4%) 70%, hsl(0 0% 2%) 100%)"
            : "radial-gradient(ellipse 100% 80% at 50% 30%, hsl(48 30% 99%) 0%, hsl(0 0% 96%) 70%, hsl(0 0% 93%) 100%)",
        }}
      />

      {/* Magnetic-field grid with radial mask */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `linear-gradient(to right, ${trace} 1px, transparent 1px),
                            linear-gradient(to bottom, ${trace} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 90%)",
        }}
      />

      {/* Slow drifting layer holds nodes + traces */}
      <div className="absolute inset-0 animate-lattice-drift">
        {/* Synapse nodes */}
        {nodes.map((n, i) => (
          <span
            key={`n${i}`}
            className="absolute rounded-full"
            style={{
              top: `${n.top}%`,
              left: `${n.left}%`,
              width: `${n.size}px`,
              height: `${n.size}px`,
              background: n.bright ? goldCore : goldDust,
              animation: `synapse-fire ${n.dur}s ${n.delay}s infinite ease-out`,
            }}
          />
        ))}

        {/* Tracing connection lines */}
        {lines.map((l, i) => (
          <span
            key={`l${i}`}
            className="absolute h-px origin-left"
            style={{
              top: `${l.top}%`,
              left: `${l.left}%`,
              width: `${l.width}%`,
              transform: `rotate(${l.rotate}deg)`,
              background: `linear-gradient(to right, ${goldCore}55, ${goldDust}22, transparent)`,
            }}
          >
            <span
              className="block h-full w-full"
              style={{
                background: goldCore,
                animation: `line-trace ${l.dur}s ${l.delay}s infinite cubic-bezier(0.4,0,0.2,1)`,
              }}
            />
          </span>
        ))}

        {/* Floating gold dust */}
        {dust.map((d, i) => (
          <span
            key={`d${i}`}
            className="absolute rounded-full blur-[1px]"
            style={{
              top: `${d.top}%`,
              left: `${d.left}%`,
              width: "3px",
              height: "3px",
              background: goldCore,
              boxShadow: `0 0 8px ${goldCore}`,
              opacity: 0.5,
              animation: `dust-float ${6 + (i % 4)}s ${d.delay}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      {/* Soft vignette so foreground content stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 4% / 0.45) 70%, hsl(0 0% 2% / 0.85) 100%)"
            : "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 100% / 0.5) 65%, hsl(0 0% 100% / 0.92) 100%)",
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
