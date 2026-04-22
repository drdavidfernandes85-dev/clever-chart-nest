import { useTheme } from "@/contexts/ThemeContext";

/**
 * Pure-CSS / SVG futuristic fintech background.
 * No raster images = perfectly crisp at any resolution.
 * Layers: deep base → animated grid → drifting orbs → flowing data line → noise.
 */
const AnimatedBackground = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Deep base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 100% 80% at 50% 0%, hsl(0 0% 11%) 0%, hsl(0 0% 6%) 60%, hsl(0 0% 4%) 100%)"
            : "radial-gradient(ellipse 100% 80% at 50% 0%, hsl(0 0% 100%) 0%, hsl(0 0% 97%) 60%, hsl(0 0% 94%) 100%)",
        }}
      />

      {/* Animated perspective grid */}
      <div className="absolute inset-0 opacity-60">
        <div
          className="absolute inset-0 animate-grid-pan"
          style={{
            backgroundImage: isDark
              ? `linear-gradient(hsl(48 100% 51% / 0.08) 1px, transparent 1px),
                 linear-gradient(90deg, hsl(48 100% 51% / 0.08) 1px, transparent 1px)`
              : `linear-gradient(hsl(48 100% 45% / 0.10) 1px, transparent 1px),
                 linear-gradient(90deg, hsl(48 100% 45% / 0.10) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%)",
          }}
        />
      </div>

      {/* Floating gold orbs (drift) */}
      <div
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-3xl animate-orb-1"
        style={{
          background:
            "radial-gradient(circle, hsl(48 100% 51% / 0.18), transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/3 -right-40 w-[640px] h-[640px] rounded-full blur-3xl animate-orb-2"
        style={{
          background:
            "radial-gradient(circle, hsl(40 100% 50% / 0.14), transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-40 left-1/4 w-[580px] h-[580px] rounded-full blur-3xl animate-orb-3"
        style={{
          background:
            "radial-gradient(circle, hsl(48 100% 51% / 0.12), transparent 70%)",
        }}
      />

      {/* Flowing data wave (SVG, animated stroke) */}
      <svg
        className="absolute inset-0 w-full h-full opacity-40"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(48 100% 51%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(48 100% 51%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(48 100% 51%)" stopOpacity="0" />
          </linearGradient>
          <filter id="waveGlow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M0,500 C200,420 400,580 600,480 C800,380 1000,520 1200,440 C1400,360 1500,500 1600,460"
          stroke="url(#waveGrad)"
          strokeWidth="2"
          fill="none"
          filter="url(#waveGlow)"
          className="animate-wave-1"
        />
        <path
          d="M0,620 C220,560 420,680 640,600 C860,520 1080,640 1300,580 C1450,540 1550,600 1600,580"
          stroke="url(#waveGrad)"
          strokeWidth="1.5"
          fill="none"
          filter="url(#waveGlow)"
          opacity="0.6"
          className="animate-wave-2"
        />
      </svg>

      {/* Vignette so content stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 6% / 0.4) 65%, hsl(0 0% 4% / 0.85) 100%)"
            : "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 100% / 0.4) 60%, hsl(0 0% 100% / 0.9) 100%)",
        }}
      />

      {/* Subtle noise */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
