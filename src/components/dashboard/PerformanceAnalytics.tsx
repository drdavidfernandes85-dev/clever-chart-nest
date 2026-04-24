import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Trade {
  id: string;
  pnl: number | null;
  closed_at: string | null;
  status: string;
}

const PerformanceAnalytics = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("trade_journal")
        .select("id, pnl, closed_at, status")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .not("pnl", "is", null)
        .order("closed_at", { ascending: true });
      setTrades(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    if (trades.length === 0) {
      return { winRate: 0, totalPnl: 0, avgRR: 0, sharpe: 0, maxDrawdown: 0, equityCurve: [] as { i: number; equity: number; date: string }[] };
    }
    const wins = trades.filter((t) => (t.pnl ?? 0) > 0);
    const winRate = (wins.length / trades.length) * 100;
    const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

    let equity = 0;
    const curve = trades.map((t, i) => {
      equity += t.pnl ?? 0;
      return { i, equity, date: t.closed_at?.slice(0, 10) ?? "" };
    });

    // Max drawdown
    let peak = 0;
    let maxDD = 0;
    for (const point of curve) {
      if (point.equity > peak) peak = point.equity;
      const dd = peak - point.equity;
      if (dd > maxDD) maxDD = dd;
    }

    // Sharpe (simplified: mean / stdev * sqrt(N))
    const returns = trades.map((t) => t.pnl ?? 0);
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length;
    const stdev = Math.sqrt(variance);
    const sharpe = stdev > 0 ? (mean / stdev) * Math.sqrt(returns.length) : 0;

    const avgWin = wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / Math.max(1, wins.length);
    const losses = trades.filter((t) => (t.pnl ?? 0) < 0);
    const avgLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0)) / Math.max(1, losses.length);
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

    return { winRate, totalPnl, avgRR, sharpe, maxDrawdown: maxDD, equityCurve: curve };
  }, [trades]);

  const cards = [
    { label: t("perf.totalPnl"), value: stats.totalPnl, icon: TrendingUp, format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`, accent: stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: t("perf.winRate"), value: stats.winRate, icon: Target, format: (v: number) => `${v.toFixed(1)}%`, accent: "text-primary" },
    { label: t("perf.avgRR"), value: stats.avgRR, icon: Activity, format: (v: number) => v.toFixed(2), accent: "text-foreground" },
    { label: t("perf.sharpe"), value: stats.sharpe, icon: TrendingDown, format: (v: number) => v.toFixed(2), accent: "text-foreground" },
  ];

  return (
    <Card className="card-glass p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold text-foreground">{t("perf.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("perf.subtitle")}</p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{trades.length} {t("perf.closedTrades")}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className={`font-display text-2xl font-semibold tabular-nums ${c.accent}`}>
                {loading ? <span className="inline-block h-7 w-16 rounded skeleton-shimmer" /> : c.format(c.value)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-[260px]">
        {loading ? (
          <div className="h-full w-full rounded-xl skeleton-shimmer" />
        ) : trades.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            {t("perf.empty")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.equityCurve}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="i" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#equityGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};

export default PerformanceAnalytics;
