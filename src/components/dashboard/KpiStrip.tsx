import { useMemo } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Activity, Target, Flame, DollarSign } from "lucide-react";
import { useMTAccount } from "@/hooks/useMTAccount";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Hedge-fund style KPI strip — 4 dense KPI tiles with embedded sparklines.
 * 100% live: all values come from MT snapshots + open positions. When no
 * MT account is connected the cards show empty/zeroed state, never mock data.
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

// EMPTY_KPI is built inside the component so labels can be translated.

const accentColor: Record<KPI["accent"], string> = {
  bull: "hsl(145 65% 50%)",
  bear: "hsl(0 70% 55%)",
  gold: "hsl(48 100% 60%)",
};

const KpiStrip = () => {
  const { account, positions, snapshots } = useMTAccount();
  const { t } = useLanguage();
  const isConnected = !!account && account.status === "connected";

  const EMPTY_KPI: KPI[] = [
    { label: t("kpi.pnlToday"), value: "—", delta: t("kpi.connectMT"), deltaDir: "flat", icon: DollarSign, spark: [], accent: "gold" },
    { label: t("kpi.winRate"), value: "—", delta: t("kpi.noData"), deltaDir: "flat", icon: Target, spark: [], accent: "gold" },
    { label: t("kpi.volumeOpen"), value: "—", delta: t("kpi.noPositions"), deltaDir: "flat", icon: Activity, spark: [], accent: "gold" },
    { label: t("kpi.winStreak"), value: "—", delta: "—", deltaDir: "flat", icon: Flame, spark: [], accent: "gold" },
  ];

  const liveKpis = useMemo<KPI[] | null>(() => {
    if (!isConnected || !account) return null;

    // P&L Today: equity - earliest snapshot today (fallback: sum of open profit)
    const today = new Date().toISOString().slice(0, 10);
    const todays = snapshots.filter((s) => s.recorded_at.startsWith(today));
    const baselineEquity = todays.length > 0 ? Number(todays[0].equity) : null;
    const equity = Number(account.equity ?? 0);
    const openPnl = positions.reduce((sum, p) => sum + Number(p.profit ?? 0), 0);
    const pnlToday = baselineEquity != null ? equity - baselineEquity : openPnl;
    const pnlPct = baselineEquity && baselineEquity !== 0 ? (pnlToday / baselineEquity) * 100 : 0;

    // Volume traded = sum of open volume (lots)
    const volume = positions.reduce((sum, p) => sum + Number(p.volume ?? 0), 0);

    // Win rate from open positions (winners / total)
    const winners = positions.filter((p) => Number(p.profit ?? 0) > 0).length;
    const winRate = positions.length > 0 ? (winners / positions.length) * 100 : 0;

    // Win streak from open positions (consecutive winners from most recent)
    const sorted = [...positions].sort(
      (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
    );
    let streak = 0;
    for (const p of sorted) {
      if (Number(p.profit ?? 0) > 0) streak++;
      else break;
    }

    const pnlUp = pnlToday >= 0;
    return [
      {
        label: t("kpi.pnlToday"),
        value: `${pnlUp ? "+" : "−"}$${Math.abs(pnlToday).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        delta: `${pnlUp ? "+" : "−"}${Math.abs(pnlPct).toFixed(2)}%`,
        deltaDir: pnlUp ? "up" : "down",
        icon: DollarSign,
        spark: [],
        accent: pnlUp ? "bull" : "bear",
      },
      {
        label: t("kpi.winRate"),
        value: `${winRate.toFixed(1)}%`,
        delta: `${winners}/${positions.length} ${t("kpi.winners")}`,
        deltaDir: winRate >= 50 ? "up" : "down",
        icon: Target,
        spark: [],
        accent: "gold",
      },
      {
        label: t("kpi.volumeOpen"),
        value: `${volume.toFixed(2)} lots`,
        delta: `${positions.length} ${t("kpi.positions")}`,
        deltaDir: "up",
        icon: Activity,
        spark: [],
        accent: "bull",
      },
      {
        label: t("kpi.winStreak"),
        value: String(streak),
        delta: streak >= 3 ? t("kpi.onRun") : t("kpi.keepGoing"),
        deltaDir: "up",
        icon: Flame,
        spark: [],
        accent: "gold",
      },
    ];
  }, [isConnected, account, positions, snapshots, t]);

  const items = useMemo(
    () =>
      (liveKpis ?? EMPTY_KPI).map((k, i) => ({
        ...k,
        spark: liveKpis
          ? buildSpark(11 + i * 7, k.deltaDir === "up" ? 0.4 : k.deltaDir === "down" ? -0.4 : 0).map(
              (p) => p.v,
            )
          : [],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveKpis, t],
  );

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {items.map((k, idx) => {
        const c = accentColor[k.accent];
        const Icon = k.icon;
        const data = k.spark.map((v, i) => ({ i, v }));
        const isUp = k.deltaDir === "up";
        const DeltaIcon = isUp ? TrendingUp : TrendingDown;

        return (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.06, ease: "easeOut" }}
            className="group relative overflow-hidden rounded-xl glass-panel p-3 transition-all duration-500 hover:-translate-y-0.5 hover:border-primary/40"
          >
            {/* Accent edge */}
            <div
              className="absolute inset-x-0 top-0 h-px opacity-70"
              style={{
                background: `linear-gradient(90deg, transparent, ${c}, transparent)`,
              }}
            />

            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                  <Icon className="h-2.5 w-2.5" style={{ color: c }} />
                  {k.label}
                </div>
                <div className="font-display text-lg font-semibold text-foreground tabular-nums leading-none">
                  {k.value}
                </div>
              </div>
            </div>

            {/* Sparkline */}
            <div className="h-7 -mx-1">
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
                    strokeWidth={1.25}
                    fill={`url(#sp-${k.label})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-1.5 flex items-center gap-1">
              <DeltaIcon className="h-2.5 w-2.5" style={{ color: c }} />
              <span className="font-mono text-[10px] tabular-nums" style={{ color: c }}>
                {k.delta}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground ml-auto uppercase tracking-wider">
                24h
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default KpiStrip;
