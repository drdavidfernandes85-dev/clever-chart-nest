import { useMemo } from "react";

/**
 * Faint glowing network of trader nodes — represents the IX Social community.
 * Lines connect nearby nodes; a few are highlighted in INFINOX yellow.
 */
const NetworkNodes = ({ className = "" }: { className?: string }) => {
  const { nodes, edges } = useMemo(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    };
    const r = rng(91);
    const nodes = Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: r() * 420,
      y: r() * 600,
      size: 1.2 + r() * 1.8,
      accent: r() > 0.8,
    }));
    const edges: { a: number; b: number }[] = [];
    nodes.forEach((n, i) => {
      const dists = nodes
        .map((m, j) => ({ j, d: Math.hypot(n.x - m.x, n.y - m.y) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      dists.forEach(({ j }) => {
        if (!edges.some((e) => (e.a === i && e.b === j) || (e.a === j && e.b === i))) {
          edges.push({ a: i, b: j });
        }
      });
    });
    return { nodes, edges };
  }, []);

  return (
    <svg
      className={`pointer-events-none select-none ${className}`}
      viewBox="0 0 420 600"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g stroke="hsl(48 100% 51%)" strokeWidth="0.5" opacity="0.22">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={nodes[e.a].x}
            y1={nodes[e.a].y}
            x2={nodes[e.b].x}
            y2={nodes[e.b].y}
          />
        ))}
      </g>
      <g>
        {nodes.map((n) => (
          <g key={n.id}>
            {n.accent && (
              <circle
                cx={n.x}
                cy={n.y}
                r={n.size + 2}
                fill="hsl(48 100% 51%)"
                opacity="0.08"
              />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.size}
              fill={n.accent ? "hsl(48 100% 51%)" : "hsl(0 0% 80%)"}
              opacity={n.accent ? 0.85 : 0.55}
            />
          </g>
        ))}
      </g>
    </svg>
  );
};

export default NetworkNodes;
