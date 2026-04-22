import { useEffect, useState, useMemo } from "react";

/**
 * Hero "Neural Execution Node" — a living lattice card with sparking nodes,
 * tracing connections, and live data readouts. Matches the site background.
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
  const [confidence, setConfidence] = useState(99.948);
  const [latticeDepth, setLatticeDepth] = useState(482911);
  const [drift, setDrift] = useState(0.089);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setConfidence((c) => +(Math.min(99.999, Math.max(99.6, c + (Math.random() - 0.5) * 0.04))).toFixed(3));
      setLatticeDepth((d) => d + Math.floor((Math.random() - 0.4) * 400));
      setDrift((d) => +(d + (Math.random() - 0.5) * 0.008).toFixed(3));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  // Stable lattice points
  const { nodes, edges } = useMemo(() => {
    const r = seedRand(7);
    const nodes = Array.from({ length: 14 }, () => ({
      x: 10 + r() * 80,
      y: 10 + r() * 80,
      size: 2 + r() * 3,
      delay: r() * 3,
      dur: 2.5 + r() * 3,
      bright: r() > 0.5,
    }));
    const edges: { from: number; to: number; delay: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      // connect each node to its 1-2 nearest neighbors
      const dists = nodes
        .map((n, j) => ({ j, d: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      for (const { j } of dists) {
        if (!edges.find((e) => (e.from === i && e.to === j) || (e.from === j && e.to === i))) {
          edges.push({ from: i, to: j, delay: r() * 3 });
        }
      }
    }
    return { nodes, edges };
  }, []);

  // Mini bar values driven by tick for live feel
  const bars = useMemo(
    () => Array.from({ length: 14 }, (_, i) => 0.35 + Math.abs(Math.sin(i * 0.7 + tick * 0.4)) * 0.65),
    [tick],
  );

  return (
    <div className="relative w-full max-w-xl">
      {/* Outer glow */}
      <div
        className="absolute -inset-12 blur-3xl opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, hsl(48 90% 60% / 0.28), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Floating sub-panel: anomaly */}
      <div
        className="absolute -left-8 -top-6 z-20 hidden md:block w-[220px] backdrop-blur-md border border-primary/30 bg-background/85 p-3 shadow-2xl shadow-black/50"
        style={{ animation: "panel-float 7s ease-in-out infinite" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="size-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(48_100%_55%)]" />
          <span className="text-[9px] font-mono text-primary uppercase tracking-[0.18em]">
            Anomaly Detected
          </span>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
          Cluster <span className="text-foreground">A-7X</span> deviating from
          standard alignment. Rerouting liquidity matrix.
        </div>
      </div>

      {/* Floating data ribbon */}
      <div
        className="absolute -right-6 top-1/2 z-20 hidden md:flex items-center gap-4 px-4 py-2 backdrop-blur border border-primary/25 bg-background/85"
        style={{ animation: "panel-float 9s ease-in-out infinite reverse" }}
      >
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
            Vol Index
          </span>
          <span className="text-xs font-mono text-foreground tabular-nums">12.44</span>
        </div>
        <div className="h-6 w-px bg-primary/30" />
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
            Drift
          </span>
          <span className="text-xs font-mono text-primary tabular-nums">
            {drift >= 0 ? "+" : ""}
            {drift.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Main neural panel */}
      <div className="relative backdrop-blur-xl border border-primary/20 bg-background/70 p-6 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex justify-between items-end border-b border-primary/15 pb-3 mb-5">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.22em]">
            Neural Execution Node
          </div>
          <div className="text-3xl font-mono font-light text-primary tabular-nums leading-none">
            {confidence.toFixed(3)}
            <span className="text-sm text-muted-foreground ml-0.5">%</span>
          </div>
        </div>

        {/* Lattice visualization */}
        <div className="relative h-48 w-full mb-5 overflow-hidden">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            {/* Grid */}
            <defs>
              <pattern id="latticeGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(48 90% 60% / 0.08)" strokeWidth="0.2" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#latticeGrid)" />

            {/* Edges */}
            {edges.map((e, i) => {
              const a = nodes[e.from];
              const b = nodes[e.to];
              return (
                <g key={`e${i}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="hsl(48 90% 60% / 0.15)"
                    strokeWidth="0.3"
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="hsl(48 95% 70%)"
                    strokeWidth="0.4"
                    strokeDasharray="6 14"
                    style={{
                      animation: `dash-flow 3s ${e.delay}s linear infinite`,
                      filter: "drop-shadow(0 0 1px hsl(48 100% 60%))",
                    }}
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((n, i) => (
              <g key={`n${i}`}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.size * 0.6}
                  fill={n.bright ? "hsl(48 95% 65%)" : "hsl(45 50% 55%)"}
                  style={{
                    animation: `synapse-fire ${n.dur}s ${n.delay}s infinite ease-out`,
                    filter: n.bright ? "drop-shadow(0 0 2px hsl(48 100% 60%))" : "none",
                    transformOrigin: `${n.x}px ${n.y}px`,
                    transformBox: "fill-box" as const,
                  }}
                />
              </g>
            ))}
          </svg>
        </div>

        {/* Data flow grid */}
        <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
              Theta Decay Var
            </span>
            <span className="text-sm font-mono text-foreground tabular-nums">
              -0.00412 <span className="text-primary">Δ</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.18em]">
              Lattice Depth
            </span>
            <span className="text-sm font-mono text-foreground tabular-nums">
              {latticeDepth.toLocaleString()} <span className="text-primary">T</span>
            </span>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground uppercase tracking-[0.18em] mb-2">
              <span>Algorithmic Confidence</span>
              <span className="text-primary">Optimal</span>
            </div>
            <div className="h-[2px] w-full bg-secondary relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_8px_hsl(48_100%_60%)] transition-all duration-1000 ease-out"
                style={{ width: `${(confidence - 99) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Live activity bars */}
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
