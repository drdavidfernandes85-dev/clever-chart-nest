import { useMemo } from "react";

/**
 * Subtle yellow + gray candlestick column drifting gently.
 * Pure SVG — no JS animation cost beyond CSS transforms.
 */
const FloatingCandles = ({ className = "", side = "left" }: { className?: string; side?: "left" | "right" }) => {
  const candles = useMemo(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    };
    const r = rng(side === "left" ? 17 : 53);
    return Array.from({ length: 14 }, (_, i) => {
      const bullish = r() > 0.55;
      const isAccent = r() > 0.78; // a few yellow standouts
      const bodyH = 18 + r() * 60;
      const wickH = bodyH + 12 + r() * 30;
      return {
        id: i,
        x: i * 30 + (r() - 0.5) * 8,
        y: 60 + r() * 240,
        bodyH,
        wickH,
        bullish,
        isAccent,
        opacity: 0.18 + r() * 0.35,
      };
    });
  }, [side]);

  return (
    <svg
      className={`pointer-events-none select-none ${className}`}
      viewBox="0 0 420 600"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g>
        {candles.map((c) => {
          const stroke = c.isAccent
            ? "hsl(48 100% 51%)"
            : c.bullish
              ? "hsl(0 0% 75%)"
              : "hsl(0 0% 55%)";
          const fill = c.isAccent
            ? "hsl(48 100% 51%)"
            : c.bullish
              ? "hsl(0 0% 70%)"
              : "hsl(0 0% 45%)";
          return (
            <g key={c.id} opacity={c.opacity}>
              {/* wick */}
              <line
                x1={c.x}
                x2={c.x}
                y1={c.y - c.wickH / 2}
                y2={c.y + c.wickH / 2}
                stroke={stroke}
                strokeWidth="1.2"
              />
              {/* body */}
              <rect
                x={c.x - 5}
                y={c.y - c.bodyH / 2}
                width="10"
                height={c.bodyH}
                fill={fill}
                stroke={stroke}
                strokeWidth="0.8"
                rx="1"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default FloatingCandles;
