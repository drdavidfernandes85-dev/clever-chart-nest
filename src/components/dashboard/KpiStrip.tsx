import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Activity, Target, Flame, DollarSign } from "lucide-react";

/**
 * Hedge-fund style KPI strip — 4 dense KPI tiles with embedded sparklines.
 * Pure presentation; data is illustrative until wired to user stats.
 */

interface KPI {
  label: string;
  value: string;
  delta: string;
  deltaDir: "up" | "down" | "flat";
  icon: typeof Activity;
  spark: number[];
  accent: "bull" | "bear" | "gold";
}

const seed = (s: number) => {
  let x = s;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
};

const buildSpark = (s: number, trend: number) => {
  const r = seed(s);
  let v = 50;
  return Array.from({ length: 24 }, (_, i) => {
    v += (r() - 0.5) * 8 + trend;
    return { i, v: Math.max(5, Math.min(95, v)) };
  });
};

const KPI_CONFIG: KPI[] = [
  {
    label: "P&L Today",
    value: "+$2,418.50",
    delta: "+4.82%",
    deltaDir: "up",
    icon: DollarSign,
    spark: [],
    accent: "bull",
  },
  {
    label: "Win Rate (30d)",
    value: "74.2%",
    delta: "+2.1%",
    deltaDir: "up",
    icon: Target,
    spark: [],
    accent: "gold",
  },
  {
    label: "Volume Traded",
    value: "12.4 lots",
    delta: "+18%",
    deltaDir: "up",
    icon: Activity,
    spark: [],
    accent: "bull",
  },
  {
    label: "Win Streak",
    value: "7",
    delta: "Personal best",
    deltaDir: "up",
    icon: Flame,
    spark: [],
    accent: "gold",
  },
];

const accentColor: Record<KPI["accent"], string> = {
  bull: "hsl(145 65% 50%)",
  bear: "hsl(0 70% 55%)",
  gold: "hsl(48 100% 60%)",
};

const KpiStrip = () => {
  const items = useMemo(
    () =>
      KPI_CONFIG.map((k, i) => ({
        ...k,
        spark: buildSpark(11 + i * 7, k.deltaDir === "up" ? 0.4 : k.deltaDir === "down" ? -0.4 : 0).map(
          (p) => p.v
        ),
      })),
    []
  );

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {items.map((k) => {
        const c = accentColor[k.accent];
        const Icon = k.icon;
        const data = k.spark.map((v, i) => ({ i, v }));
        const isUp = k.deltaDir === "up";
        const DeltaIcon = isUp ? TrendingUp : TrendingDown;

        return (
          <div
            key={k.label}
            className="group relative overflow-hidden rounded-2xl glass-panel p-4 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-25px_hsl(48_100%_51%/0.4)]"
          >
            {/* Accent edge */}
            <div
              className="absolute inset-x-0 top-0 h-px opacity-70"
              style={{
                background: `linear-gradient(90deg, transparent, ${c}, transparent)`,
              }}
            />

            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  <Icon className="h-3 w-3" style={{ color: c }} />
                  {k.label}
                </div>
                <div className="font-display text-2xl font-semibold text-foreground tabular-nums leading-none">
                  {k.value}
                </div>
              </div>
            </div>

            {/* Sparkline */}
            <div className="h-10 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`sp-${k.label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={c}
                    strokeWidth={1.5}
                    fill={`url(#sp-${k.label})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <DeltaIcon className="h-3 w-3" style={{ color: c }} />
              <span className="font-mono text-[11px] tabular-nums" style={{ color: c }}>
                {k.delta}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground ml-auto uppercase tracking-wider">
                24h
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KpiStrip;
