import { useEffect, useState } from "react";

/**
 * Animated SVG trading chart for the hero.
 * - Live candles materialize one-by-one
 * - Trend line draws progressively
 * - Floating ticker badges with pulsing prices
 * - Gold particles drift upward
 * Pure SVG + CSS, no images.
 */

type Candle = {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  bullish: boolean;
};

const generateCandles = (count: number): Candle[] => {
  const candles: Candle[] = [];
  let price = 50;
  const stepX = 480 / count;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.4) * 8; // upward bias
    const open = price;
    const close = Math.max(10, Math.min(90, price + change));
    const high = Math.max(open, close) + Math.random() * 4;
    const low = Math.min(open, close) - Math.random() * 4;
    candles.push({
      x: 40 + i * stepX,
      open,
      close,
      high,
      low,
      bullish: close >= open,
    });
    price = close;
  }
  return candles;
};

const AnimatedTradingChart = () => {
  const [candles] = useState(() => generateCandles(22));
  const [tick, setTick] = useState(0);
  const [livePrice, setLivePrice] = useState(1.0847);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setLivePrice((p) => +(p + (Math.random() - 0.45) * 0.0015).toFixed(4));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  // Convert price (0-100) to y in viewbox 0-220 (inverted)
  const yScale = (p: number) => 200 - (p / 100) * 170;

  // Path along closes for trend line
  const trendPath = candles
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${yScale(c.close)}`)
    .join(" ");

  const lastCandle = candles[candles.length - 1];
  const trend = lastCandle.close >= candles[0].close ? "up" : "down";

  return (
    <div className="relative w-full max-w-xl aspect-[5/4]">
      {/* Glow halo */}
      <div
        className="absolute inset-0 blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 55%, hsl(48 100% 51% / 0.35), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 540 430"
        className="relative w-full h-full"
        role="img"
        aria-label="Animated live trading chart"
      >
        <defs>
          <linearGradient id="bgPanel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 0% 12%)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(0 0% 6%)" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(48 100% 60%)" />
            <stop offset="100%" stopColor="hsl(40 100% 45%)" />
          </linearGradient>

          <linearGradient id="trendGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(48 100% 51%)" stopOpacity="0" />
            <stop offset="20%" stopColor="hsl(48 100% 51%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(48 100% 65%)" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(48 100% 51%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(48 100% 51%)" stopOpacity="0" />
          </linearGradient>

          <filter id="goldGlow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Glass panel */}
        <rect
          x="20"
          y="20"
          width="500"
          height="390"
          rx="20"
          fill="url(#bgPanel)"
          stroke="hsl(48 100% 51% / 0.25)"
          strokeWidth="1"
        />

        {/* Inner grid */}
        <g opacity="0.18">
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`h${i}`}
              x1="40"
              x2="520"
              y1={50 + i * 40}
              y2={50 + i * 40}
              stroke="hsl(48 100% 51%)"
              strokeWidth="0.5"
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line
              key={`v${i}`}
              x1={60 + i * 75}
              x2={60 + i * 75}
              y1="40"
              y2="240"
              stroke="hsl(48 100% 51%)"
              strokeWidth="0.5"
            />
          ))}
        </g>

        {/* Area fill under trend */}
        <path
          d={`${trendPath} L ${lastCandle.x} 230 L ${candles[0].x} 230 Z`}
          fill="url(#areaFill)"
          opacity="0.6"
        />

        {/* Trend line */}
        <path
          d={trendPath}
          stroke="url(#trendGrad)"
          strokeWidth="2.5"
          fill="none"
          filter="url(#goldGlow)"
          strokeDasharray="800"
          strokeDashoffset="800"
          className="animate-draw-line"
        />

        {/* Candles */}
        <g>
          {candles.map((c, i) => {
            const top = yScale(Math.max(c.open, c.close));
            const bottom = yScale(Math.min(c.open, c.close));
            const bodyH = Math.max(2, bottom - top);
            const fill = c.bullish ? "url(#goldFill)" : "hsl(0 0% 35%)";
            return (
              <g
                key={i}
                style={{
                  animation: `candle-pop 0.5s ${i * 0.06}s both ease-out`,
                  transformOrigin: `${c.x}px 230px`,
                }}
              >
                <line
                  x1={c.x}
                  x2={c.x}
                  y1={yScale(c.high)}
                  y2={yScale(c.low)}
                  stroke={c.bullish ? "hsl(48 100% 55%)" : "hsl(0 0% 50%)"}
                  strokeWidth="1"
                />
                <rect
                  x={c.x - 6}
                  y={top}
                  width="12"
                  height={bodyH}
                  rx="1.5"
                  fill={fill}
                  filter={c.bullish ? "url(#goldGlow)" : undefined}
                />
              </g>
            );
          })}
        </g>

        {/* Pulse dot at last candle */}
        <g>
          <circle
            cx={lastCandle.x}
            cy={yScale(lastCandle.close)}
            r="4"
            fill="hsl(48 100% 60%)"
            filter="url(#goldGlow)"
          />
          <circle
            cx={lastCandle.x}
            cy={yScale(lastCandle.close)}
            r="4"
            fill="hsl(48 100% 60%)"
            opacity="0.6"
            className="animate-ping-slow"
          />
        </g>

        {/* Bottom info row */}
        <g transform="translate(40, 270)">
          {/* EUR/USD live */}
          <rect
            width="200"
            height="50"
            rx="10"
            fill="hsl(0 0% 8% / 0.7)"
            stroke="hsl(48 100% 51% / 0.3)"
          />
          <circle cx="18" cy="25" r="4" fill="hsl(48 100% 55%)" className="animate-ping-slow" />
          <text x="32" y="22" fill="hsl(0 0% 70%)" fontSize="10" fontFamily="monospace">
            EUR / USD
          </text>
          <text
            x="32"
            y="40"
            fill="hsl(48 100% 55%)"
            fontSize="16"
            fontWeight="700"
            fontFamily="monospace"
          >
            {livePrice.toFixed(4)}
          </text>
          <text
            x="180"
            y="40"
            fill={trend === "up" ? "hsl(140 60% 55%)" : "hsl(0 70% 55%)"}
            fontSize="11"
            fontWeight="700"
            fontFamily="monospace"
            textAnchor="end"
          >
            {trend === "up" ? "▲ +0.42%" : "▼ -0.18%"}
          </text>
        </g>

        <g transform="translate(260, 270)">
          <rect
            width="220"
            height="50"
            rx="10"
            fill="hsl(0 0% 8% / 0.7)"
            stroke="hsl(48 100% 51% / 0.3)"
          />
          <text x="14" y="22" fill="hsl(0 0% 70%)" fontSize="10" fontFamily="monospace">
            ACTIVE SIGNALS
          </text>
          <text
            x="14"
            y="40"
            fill="hsl(0 0% 95%)"
            fontSize="16"
            fontWeight="700"
            fontFamily="monospace"
          >
            12 LIVE
          </text>
          <g transform="translate(150, 18)">
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={i * 16}
                cy="8"
                r="6"
                fill="hsl(48 100% 51%)"
                opacity={0.3 + i * 0.25}
                style={{
                  animation: `signal-blink 1.4s ${i * 0.2}s infinite ease-in-out`,
                }}
              />
            ))}
          </g>
        </g>

        {/* Win-rate stat */}
        <g transform="translate(40, 340)">
          <rect
            width="440"
            height="56"
            rx="10"
            fill="hsl(0 0% 8% / 0.7)"
            stroke="hsl(48 100% 51% / 0.3)"
          />
          <text x="16" y="22" fill="hsl(0 0% 70%)" fontSize="10" fontFamily="monospace">
            30D WIN RATE
          </text>
          <text
            x="16"
            y="44"
            fill="hsl(48 100% 60%)"
            fontSize="22"
            fontWeight="800"
            fontFamily="monospace"
          >
            74.8%
          </text>
          {/* Mini bars */}
          <g transform="translate(150, 18)">
            {Array.from({ length: 18 }).map((_, i) => {
              const h = 8 + Math.abs(Math.sin(i * 0.6 + tick * 0.3)) * 24;
              return (
                <rect
                  key={i}
                  x={i * 14}
                  y={32 - h}
                  width="8"
                  height={h}
                  rx="1"
                  fill="hsl(48 100% 51%)"
                  opacity={0.4 + (i / 18) * 0.5}
                  style={{ transition: "all 0.6s ease-out" }}
                />
              );
            })}
          </g>
        </g>

        {/* Floating particles */}
        <g>
          {Array.from({ length: 8 }).map((_, i) => (
            <circle
              key={i}
              cx={60 + ((i * 73) % 460)}
              cy={50 + ((i * 31) % 180)}
              r="1.5"
              fill="hsl(48 100% 60%)"
              opacity="0.6"
              style={{
                animation: `particle-float ${4 + (i % 3)}s ${i * 0.3}s infinite ease-in-out`,
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default AnimatedTradingChart;
