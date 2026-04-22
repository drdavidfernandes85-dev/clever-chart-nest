import { useTheme } from "@/contexts/ThemeContext";
import bgDark from "@/assets/bg-futuristic-dark.jpg";
import bgLight from "@/assets/bg-futuristic-light.jpg";

const AnimatedBackground = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Base image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{
          backgroundImage: `url(${isDark ? bgDark : bgLight})`,
          opacity: isDark ? 0.55 : 0.45,
        }}
      />

      {/* Slow parallax drift */}
      <div
        className="absolute inset-0 bg-cover bg-center animate-bg-drift"
        style={{
          backgroundImage: `url(${isDark ? bgDark : bgLight})`,
          opacity: isDark ? 0.18 : 0.12,
          mixBlendMode: isDark ? "screen" : "multiply",
        }}
      />

      {/* Vignette / fade to background color so content stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 7% / 0.55) 60%, hsl(0 0% 7%) 100%)"
            : "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 100% / 0.55) 55%, hsl(0 0% 100%) 100%)",
        }}
      />

      {/* Subtle gold glow accents */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, hsl(48 100% 51% / 0.08), transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, hsl(48 100% 51% / 0.06), transparent 70%)",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
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
