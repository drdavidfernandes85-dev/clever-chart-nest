import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

/**
 * Topographical Gold — sitewide background.
 * 3D mesh perspective + depth contour rings + drifting heatmap currents.
 * Pure CSS/SVG, GPU-friendly transforms only.
 */

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

  // Stable per-mount layout — heatmap blobs + contour offsets
  const { blobs, sparks } = useMemo(() => {
    const r = seedRand(91);
    const blobs = Array.from({ length: 5 }, () => ({
      top: 10 + r() * 80,
      left: 10 + r() * 80,
      size: 28 + r() * 32,
      delay: r() * 8,
      dur: 18 + r() * 12,
      hue: 38 + r() * 14,
    }));
    const sparks = Array.from({ length: 18 }, () => ({
      top: r() * 100,
      left: r() * 100,
      delay: r() * 6,
      dur: 4 + r() * 4,
      size: 1 + r() * 2,
    }));
    return { blobs, sparks };
  }, []);

  const meshLine = isDark ? "hsl(45 70% 50% / 0.18)" : "hsl(40 80% 35% / 0.22)";
  const meshLineStrong = isDark ? "hsl(48 95% 60% / 0.32)" : "hsl(40 90% 40% / 0.4)";
  const goldCore = "hsl(48 95% 65%)";

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
            ? "radial-gradient(ellipse 100% 80% at 50% 40%, hsl(0 0% 9%) 0%, hsl(0 0% 5%) 65%, hsl(0 0% 2%) 100%)"
            : "radial-gradient(ellipse 100% 80% at 50% 40%, hsl(48 30% 99%) 0%, hsl(38 25% 96%) 65%, hsl(0 0% 93%) 100%)",
        }}
      />

      {/* Heatmap currents — slowly drifting gold blobs */}
      <div className="absolute inset-0 opacity-70">
        {blobs.map((b, i) => (
          <div
            key={`b${i}`}
            className="absolute rounded-full"
            style={{
              top: `${b.top}%`,
              left: `${b.left}%`,
              width: `${b.size}vw`,
              height: `${b.size}vw`,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, hsl(${b.hue} 90% 55% / ${isDark ? 0.18 : 0.12}) 0%, hsl(${b.hue} 80% 50% / ${isDark ? 0.06 : 0.04}) 40%, transparent 70%)`,
              filter: "blur(30px)",
              animation: `current-drift ${b.dur}s ${b.delay}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* 3D perspective topographical mesh */}
      <div
        className="absolute inset-0"
        style={{
          perspective: "1200px",
          perspectiveOrigin: "50% 40%",
        }}
      >
        <div
          className="absolute left-1/2 top-[55%] origin-center animate-mesh-rotate"
          style={{
            width: "260vw",
            height: "260vh",
            transform: "translate(-50%, -50%) rotateX(68deg)",
            transformStyle: "preserve-3d",
            backgroundImage: `
              linear-gradient(to right, ${meshLine} 1px, transparent 1px),
              linear-gradient(to bottom, ${meshLine} 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
            maskImage:
              "radial-gradient(ellipse 50% 60% at 50% 50%, black 20%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 50% 60% at 50% 50%, black 20%, transparent 80%)",
          }}
        />
      </div>

      {/* Concentric depth contours — topographic feel */}
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50"
        width="1400"
        height="1400"
        viewBox="-700 -700 1400 1400"
        style={{ maxWidth: "120vw", maxHeight: "120vh" }}
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const r = 80 + i * 70;
          return (
            <ellipse
              key={`c${i}`}
              cx="0"
              cy="0"
              rx={r}
              ry={r * 0.45}
              fill="none"
              stroke={i % 3 === 0 ? meshLineStrong : meshLine}
              strokeWidth={i % 3 === 0 ? 1 : 0.6}
              strokeDasharray={i % 2 === 0 ? "none" : "4 8"}
              style={{
                animation: `contour-pulse ${10 + i * 1.5}s ${i * 0.4}s ease-in-out infinite`,
                transformOrigin: "center",
              }}
            />
          );
        })}
      </svg>

      {/* Floating gold sparks */}
      {sparks.map((s, i) => (
        <span
          key={`s${i}`}
          className="absolute rounded-full"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: goldCore,
            boxShadow: `0 0 ${4 + s.size * 2}px ${goldCore}`,
            opacity: 0.6,
            animation: `spark-rise ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}

      {/* Soft vignette so foreground content stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 4% / 0.5) 65%, hsl(0 0% 2% / 0.9) 100%)"
            : "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 100% / 0.5) 60%, hsl(0 0% 100% / 0.94) 100%)",
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
