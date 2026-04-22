import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

/**
 * Liquid Capital — sitewide trading-themed ambient background.
 * Layers (bottom → top):
 *   1. Deep market base + liquid-shifting gold/green blooms
 *   2. Hex data mesh (faded edges)
 *   3. Animated horizontal data traces
 *   4. Flowing chart polylines (price action)
 *   5. Candlestick skyline drifting across lower third
 *   6. Capital-flow particle streams (rising comets)
 *   7. Soft vignette for foreground readability
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

  const { candles, streams, chartPaths, traces } = useMemo(() => {
    const r = seedRand(137);

    // Candlestick skyline — stylized OHLC bars across bottom third
    const candles = Array.from({ length: 48 }, (_, i) => {
      const bullish = r() > 0.45;
      const bodyH = 8 + r() * 42;
      const wickH = bodyH + 6 + r() * 24;
      const yOffset = r() * 60;
      return {
        x: (i / 48) * 100,
        bodyH,
        wickH,
        yOffset,
        bullish,
      };
    });

    // Capital flow streams (vertical lanes with rising comets)
    const streams = Array.from({ length: 9 }, (_, i) => ({
      left: ((i + 0.5) / 9) * 100 + (r() - 0.5) * 4,
      size: 1.5 + r() * 2,
      trailH: 60 + r() * 80,
      delay: r() * 12,
      dur: 7 + r() * 8,
      color: r() > 0.55 ? "gold" : r() > 0.4 ? "bull" : "white",
    }));

    // Flowing chart polylines — generate jagged price-action paths
    const buildPath = (seed: number, baseY: number, amp: number) => {
      const rr = seedRand(seed);
      const points: string[] = [];
      const steps = 44;
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
      { d: buildPath(11, 32, 4), dur: 22, delay: 0, color: "bull" },
      { d: buildPath(29, 52, 5), dur: 28, delay: 4, color: "gold" },
      { d: buildPath(53, 68, 3.5), dur: 25, delay: 8, color: "bull" },
    ];

    // Horizontal data traces (thin sweeping highlights)
    const traces = [
      { top: 28, dur: 14, delay: 0, color: "gold", w: 18 },
      { top: 62, dur: 22, delay: 6, color: "white", w: 24 },
    ];

    return { candles, streams, chartPaths, traces };
  }, []);

  const bull = isDark ? "hsl(145 65% 50%)" : "hsl(145 55% 38%)";
  const bear = isDark ? "hsl(0 70% 55%)" : "hsl(0 65% 48%)";
  const gold = isDark ? "hsl(48 95% 60%)" : "hsl(42 90% 45%)";
  const white = isDark ? "hsl(0 0% 95%)" : "hsl(0 0% 30%)";
  const meshStroke = isDark ? "hsl(48 60% 55% / 0.08)" : "hsl(40 50% 35% / 0.08)";

  const pickColor = (k: string) => (k === "gold" ? gold : k === "bull" ? bull : white);

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

      {/* Liquid-shifting capital blooms (mix-blend for glow) */}
      <div className="absolute inset-0 mix-blend-screen pointer-events-none">
        <div
          className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full blur-[80px] animate-liquid-shift-a"
          style={{
            background: `radial-gradient(ellipse at center, hsl(48 95% 55% / ${isDark ? 0.18 : 0.08}) 0%, transparent 60%)`,
          }}
        />
        <div
          className="absolute top-[35%] -left-[20%] w-[80vw] h-[80vw] rounded-full blur-[100px] animate-liquid-shift-b"
          style={{
            background: `radial-gradient(ellipse at center, hsl(145 65% 40% / ${isDark ? 0.13 : 0.06}) 0%, transparent 60%)`,
          }}
        />
        <div
          className="absolute -bottom-[30%] left-[15%] w-[60vw] h-[60vw] rounded-full blur-[90px] animate-liquid-shift-a"
          style={{
            background: `radial-gradient(ellipse at center, hsl(48 80% 50% / ${isDark ? 0.10 : 0.04}) 0%, transparent 60%)`,
            animationDelay: "-8s",
          }}
        />
      </div>

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
          <pattern id="hexgrid" width="56" height="48.5" patternUnits="userSpaceOnUse">
            <path
              d="M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z"
              fill="none"
              stroke={meshStroke}
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexgrid)" className="animate-hex-pulse" />
      </svg>

      {/* 3 — Horizontal data traces (sweeping highlights) */}
      {traces.map((t, i) => {
        const c = pickColor(t.color);
        return (
          <div
            key={`tr${i}`}
            className="absolute left-0 w-full overflow-hidden pointer-events-none"
            style={{ top: `${t.top}%`, height: "1px" }}
          >
            <div
              className="h-full animate-data-stream"
              style={{
                width: `${t.w}rem`,
                background: `linear-gradient(to right, transparent, ${c}, transparent)`,
                opacity: isDark ? 0.5 : 0.35,
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
              }}
            />
          </div>
        );
      })}

      {/* 4 — Flowing chart polylines (price action) */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {chartPaths.map((p, i) => {
          const stroke = p.color === "bull" ? bull : gold;
          return (
            <polyline
              key={`cp${i}`}
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
          );
        })}
      </svg>

      {/* 5 — Candlestick skyline drifting across the lower third */}
      <div className="absolute inset-x-0 bottom-0 h-[42%] opacity-[0.22]">
        <div className="absolute inset-0 animate-candle-drift" style={{ width: "200%" }}>
          {[0, 1].map((half) => (
            <svg
              key={half}
              className="absolute top-0 w-1/2 h-full"
              style={{ left: `${half * 50}%` }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {candles.map((c, i) => {
                const color = c.bullish ? bull : bear;
                const cy = 70 + c.yOffset * 0.3;
                return (
                  <g key={`c${half}${i}`} stroke={color} fill={color}>
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
          ))}
        </div>
      </div>

      {/* 6 — Capital-flow streams (rising comets with trails) */}
      {streams.map((s, i) => {
        const c = pickColor(s.color);
        return (
          <div
            key={`st${i}`}
            className="absolute bottom-0 animate-capital-rise pointer-events-none"
            style={{
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.trailH}px`,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
              opacity: 0,
            }}
          >
            {/* Trail */}
            <div
              className="absolute inset-x-0 top-0 bottom-2 rounded-full"
              style={{
                background: `linear-gradient(to top, transparent, ${c})`,
                filter: "blur(1.5px)",
                opacity: isDark ? 0.85 : 0.55,
              }}
            />
            {/* Head */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
              style={{
                width: `${s.size + 1}px`,
                height: `${s.size + 1}px`,
                background: c,
                boxShadow: `0 0 ${6 + s.size * 4}px ${c}, 0 0 ${12 + s.size * 6}px ${c}`,
              }}
            />
          </div>
        );
      })}

      {/* 7 — Vignette for foreground readability */}
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
