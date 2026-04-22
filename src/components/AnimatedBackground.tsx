import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

/**
 * Liquid Capital — sitewide trading-themed ambient background.
 * Layers: deep market base · hex data mesh · flowing chart polylines ·
 * candlestick skyline · capital flow particles · vignette.
 * All GPU-friendly transforms/opacity. Respects prefers-reduced-motion via CSS.
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

  const { candles, particles, chartPaths } = useMemo(() => {
    const r = seedRand(137);

    // Candlestick skyline — stylized OHLC bars across bottom third
    const candles = Array.from({ length: 42 }, (_, i) => {
      const bullish = r() > 0.45;
      const bodyH = 8 + r() * 38;
      const wickH = bodyH + 6 + r() * 22;
      const yOffset = r() * 60;
      return {
        x: (i / 42) * 100,
        bodyH,
        wickH,
        yOffset,
        bullish,
        delay: r() * 6,
      };
    });

    // Rising capital particles
    const particles = Array.from({ length: 20 }, () => ({
      left: r() * 100,
      size: 1.5 + r() * 2.5,
      delay: r() * 10,
      dur: 8 + r() * 10,
      gold: r() > 0.5,
    }));

    // Flowing chart polylines — generate jagged price-action paths
    const buildPath = (seed: number, baseY: number, amp: number) => {
      const rr = seedRand(seed);
      const points: string[] = [];
      const steps = 40;
      let y = baseY;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * 100;
        y += (rr() - 0.5) * amp;
        y = Math.max(baseY - amp * 2, Math.min(baseY + amp * 2, y));
        points.push(`${x},${y}`);
      }
      return points.join(" ");
    };

    const chartPaths = [
      { d: buildPath(11, 35, 4), dur: 22, delay: 0, color: "bull" },
      { d: buildPath(29, 55, 5), dur: 28, delay: 4, color: "gold" },
      { d: buildPath(53, 70, 3.5), dur: 25, delay: 8, color: "bull" },
    ];

    return { candles, particles, chartPaths };
  }, []);

  const bull = isDark ? "hsl(145 65% 50%)" : "hsl(145 55% 38%)";
  const bear = isDark ? "hsl(0 70% 55%)" : "hsl(0 65% 48%)";
  const gold = isDark ? "hsl(48 95% 60%)" : "hsl(42 90% 45%)";
  const meshStroke = isDark ? "hsl(48 60% 55% / 0.08)" : "hsl(40 50% 35% / 0.08)";

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden motion-reduce:[&_*]:!animate-none"
      aria-hidden="true"
    >
      {/* 1 — Deep market base */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? `radial-gradient(ellipse 90% 70% at 50% 35%, hsl(48 25% 10%) 0%, hsl(0 0% 6%) 55%, hsl(0 0% 3%) 100%)`
            : `radial-gradient(ellipse 90% 70% at 50% 35%, hsl(48 30% 98%) 0%, hsl(40 20% 95%) 55%, hsl(0 0% 92%) 100%)`,
        }}
      />

      {/* Subtle warm/cool capital glow accents */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `
            radial-gradient(circle at 18% 25%, hsl(145 65% 35% / ${isDark ? 0.18 : 0.08}) 0%, transparent 45%),
            radial-gradient(circle at 82% 30%, hsl(48 95% 55% / ${isDark ? 0.16 : 0.08}) 0%, transparent 45%),
            radial-gradient(circle at 50% 90%, hsl(48 80% 45% / ${isDark ? 0.12 : 0.05}) 0%, transparent 55%)
          `,
        }}
      />

      {/* 2 — Hex / data-grid mesh, masked to fade at edges */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 85%)",
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="hexgrid" width="56" height="48.5" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
            <path
              d="M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z"
              fill="none"
              stroke={meshStroke}
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#hexgrid)"
          className="animate-hex-pulse"
        />
      </svg>

      {/* 3 — Flowing chart polylines (price action) */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {chartPaths.map((p, i) => {
          const stroke = p.color === "bull" ? bull : gold;
          return (
            <g key={`cp${i}`}>
              <polyline
                points={p.d}
                fill="none"
                stroke={stroke}
                strokeWidth="0.25"
                strokeOpacity={isDark ? 0.55 : 0.4}
                vectorEffect="non-scaling-stroke"
                style={{
                  strokeDasharray: 220,
                  strokeDashoffset: 220,
                  animation: `chart-draw ${p.dur}s ${p.delay}s linear infinite`,
                  filter: `drop-shadow(0 0 2px ${stroke})`,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* 4 — Candlestick skyline drifting across the lower third */}
      <div className="absolute inset-x-0 bottom-0 h-[42%] opacity-[0.22]">
        <div className="absolute inset-0 animate-candle-drift" style={{ width: "200%" }}>
          <svg
            className="absolute inset-0 w-1/2 h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {candles.map((c, i) => {
              const color = c.bullish ? bull : bear;
              const cy = 70 + c.yOffset * 0.3;
              return (
                <g key={`ca${i}`} stroke={color} fill={color}>
                  <line
                    x1={c.x}
                    x2={c.x}
                    y1={cy - c.wickH * 0.4}
                    y2={cy + c.wickH * 0.4}
                    strokeWidth="0.15"
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={c.x - 0.7}
                    y={cy - c.bodyH * 0.4}
                    width="1.4"
                    height={c.bodyH * 0.8}
                    fillOpacity="0.85"
                  />
                </g>
              );
            })}
          </svg>
          {/* Duplicate for seamless drift */}
          <svg
            className="absolute left-1/2 top-0 w-1/2 h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {candles.map((c, i) => {
              const color = c.bullish ? bull : bear;
              const cy = 70 + c.yOffset * 0.3;
              return (
                <g key={`cb${i}`} stroke={color} fill={color}>
                  <line
                    x1={c.x}
                    x2={c.x}
                    y1={cy - c.wickH * 0.4}
                    y2={cy + c.wickH * 0.4}
                    strokeWidth="0.15"
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={c.x - 0.7}
                    y={cy - c.bodyH * 0.4}
                    width="1.4"
                    height={c.bodyH * 0.8}
                    fillOpacity="0.85"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 5 — Capital flow particles (rising) */}
      {particles.map((p, i) => {
        const color = p.gold ? gold : bull;
        return (
          <span
            key={`pt${i}`}
            className="absolute rounded-full bottom-0"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: color,
              boxShadow: `0 0 ${4 + p.size * 3}px ${color}`,
              opacity: 0,
              animation: `capital-rise ${p.dur}s ${p.delay}s ease-in infinite`,
            }}
          />
        );
      })}

      {/* 6 — Top vignette + bottom seam for content readability */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 4% / 0.45) 70%, hsl(0 0% 2% / 0.92) 100%)"
            : "radial-gradient(ellipse at center, transparent 0%, hsl(0 0% 100% / 0.45) 65%, hsl(0 0% 100% / 0.95) 100%)",
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
