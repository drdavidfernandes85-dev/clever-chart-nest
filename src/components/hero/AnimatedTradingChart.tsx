import { useEffect, useState, useMemo } from "react";

/**
 * Hero "Topographical Heatmap" panel — a 3D depth-mapped trading visualization
 * with rotating mesh, momentum contour rings, and live momentum readouts.
 */

const seedRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const AnimatedTradingChart = () => {
  const [tick, setTick] = useState(0);
  const [momentum, setMomentum] = useState(87.42);
  const [volume, setVolume] = useState(1284033);
  const [delta, setDelta] = useState(0.214);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setMomentum((m) => +(Math.min(99.9, Math.max(60, m + (Math.random() - 0.45) * 1.6))).toFixed(2));
      setVolume((v) => v + Math.floor((Math.random() - 0.4) * 1200));
      setDelta((d) => +(d + (Math.random() - 0.5) * 0.04).toFixed(3));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Stable heatmap cell intensities (16x9 grid)
  const cells = useMemo(() => {
    const r = seedRand(23);
    return Array.from({ length: 16 * 9 }, () => 0.15 + r() * 0.85);
  }, []);

  // Live oscillating momentum bars
  const bars = useMemo(
    () => Array.from({ length: 18 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.55 + tick * 0.35)) * 0.75),
    [tick],
  );

  return (
    <div className="relative w-full max-w-xl">
      {/* Outer glow */}
      <div
        className="absolute -inset-12 blur-3xl opacity-70 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, hsl(45 90% 55% / 0.3), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Floating sub-panel: depth scanner */}
      <div
        className="absolute -left-8 -top-6 z-20 hidden md:block w-[230px] backdrop-blur-md border border-primary/30 bg-background/85 p-3 shadow-2xl shadow-black/50"
        style={{ animation: "panel-float 7s ease-in-out infinite" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="size-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(48_100%_55%)]" />
          <span className="text-[9px] font-mono text-primary uppercase tracking-[0.18em]">
            Liquidity Surge
          </span>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
          Deep order block forming at <span className="text-foreground">1.0842</span>.
          Bullish momentum elevated.
        </div>
      </div>

      {/* Floating data ribbon */}
      <div
        className="absolute -right-6 top-1/2 z-20 hidden md:flex items-center gap-4 px-4 py-2 backdrop-blur border border-primary/25 bg-background/85"
        style={{ animation: "panel-float 9s ease-in-out infinite reverse" }}
      >
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
            Δ Vol
          </span>
          <span className="text-xs font-mono text-foreground tabular-nums">+18.3%</span>
        </div>
        <div className="h-6 w-px bg-primary/30" />
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
            Delta
          </span>
          <span className="text-xs font-mono text-primary tabular-nums">
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Main topographic panel */}
      <div className="relative backdrop-blur-xl border border-primary/20 bg-background/70 p-6 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex justify-between items-end border-b border-primary/15 pb-3 mb-5">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.22em]">
            Momentum Topography
          </div>
          <div className="text-3xl font-mono font-light text-primary tabular-nums leading-none">
            {momentum.toFixed(2)}
            <span className="text-sm text-muted-foreground ml-0.5">%</span>
          </div>
        </div>

        {/* 3D heatmap visualization */}
        <div
          className="relative h-48 w-full mb-5 overflow-hidden"
          style={{ perspective: "600px" }}
        >
          {/* Tilted heatmap grid */}
          <div
            className="absolute inset-0 grid grid-cols-16 gap-[2px] animate-mesh-rotate-slow"
            style={{
              gridTemplateColumns: "repeat(16, 1fr)",
              gridTemplateRows: "repeat(9, 1fr)",
              transform: "rotateX(45deg) scale(1.2)",
              transformOrigin: "center 70%",
              maskImage:
                "radial-gradient(ellipse 70% 90% at 50% 50%, black 30%, transparent 95%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 90% at 50% 50%, black 30%, transparent 95%)",
            }}
          >
            {cells.map((v, i) => {
              const wave = (Math.sin(i * 0.4 + tick * 0.5) + 1) * 0.5;
              const intensity = v * 0.6 + wave * 0.4;
              return (
                <div
                  key={i}
                  className="transition-all duration-1000 ease-out"
                  style={{
                    background: `hsl(${42 + intensity * 12} 95% ${30 + intensity * 35}% / ${0.15 + intensity * 0.6})`,
                    boxShadow: intensity > 0.78 ? `0 0 6px hsl(48 100% 60% / 0.6)` : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* Contour ring overlay */}
          <svg
            viewBox="-50 -28 100 56"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {[10, 18, 26, 34].map((r, i) => (
              <ellipse
                key={i}
                cx="0"
                cy="0"
                rx={r}
                ry={r * 0.5}
                fill="none"
                stroke="hsl(48 95% 60%)"
                strokeWidth="0.25"
                strokeOpacity={0.45 - i * 0.08}
                strokeDasharray="2 3"
                style={{ animation: `contour-pulse ${6 + i}s ${i * 0.3}s ease-in-out infinite` }}
              />
            ))}
            {/* Center pulse */}
            <circle
              cx="0"
              cy="0"
              r="1.2"
              fill="hsl(48 100% 65%)"
              style={{ filter: "drop-shadow(0 0 3px hsl(48 100% 60%))" }}
            >
              <animate attributeName="r" values="1.2;2.2;1.2" dur="2.4s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        {/* Data flow grid */}
        <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
              Order Flow Imbalance
            </span>
            <span className="text-sm font-mono text-foreground tabular-nums">
              +0.0421 <span className="text-primary">↑</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
              Cumulative Volume
            </span>
            <span className="text-sm font-mono text-foreground tabular-nums">
              {volume.toLocaleString()} <span className="text-primary">L</span>
            </span>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground uppercase tracking-[0.18em] mb-2">
              <span>Momentum Strength</span>
              <span className="text-primary">Bullish</span>
            </div>
            <div className="h-[2px] w-full bg-secondary relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_8px_hsl(48_100%_60%)] transition-all duration-1000 ease-out"
                style={{ width: `${momentum}%` }}
              />
            </div>
          </div>
        </div>

        {/* Live momentum bars */}
        <div className="flex items-end gap-1 h-10">
          {bars.map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/60 transition-all duration-700 ease-out"
              style={{
                height: `${v * 100}%`,
                opacity: 0.4 + (i / bars.length) * 0.55,
                boxShadow: i === bars.length - 1 ? "0 0 10px hsl(48 100% 60%)" : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimatedTradingChart;
