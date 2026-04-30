import { useEffect, useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, TrendingUp, TrendingDown, Target, Activity, BarChart3, Hash } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface Trade {
  id: string;
  pnl: number | null;
  closed_at: string | null;
  status: string;
}

type PresetKey = "7d" | "30d" | "90d" | "ytd" | "all" | "custom";

const AnalyticsFilteredView = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
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

  const applyPreset = (p: PresetKey) => {
    setPreset(p);
    const now = new Date();
    if (p === "7d") setRange({ from: subDays(now, 7), to: now });
    else if (p === "30d") setRange({ from: subDays(now, 30), to: now });
    else if (p === "90d") setRange({ from: subDays(now, 90), to: now });
    else if (p === "ytd") setRange({ from: new Date(now.getFullYear(), 0, 1), to: now });
    else if (p === "all") setRange(undefined);
  };

  const filtered = useMemo(() => {
    if (!range?.from && !range?.to) return trades;
    const fromMs = range?.from ? startOfDay(range.from).getTime() : -Infinity;
    const toMs = range?.to ? endOfDay(range.to).getTime() : Infinity;
    return trades.filter((tr) => {
      if (!tr.closed_at) return false;
      const ts = new Date(tr.closed_at).getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }, [trades, range]);

  const stats = useMemo(() => {
    if (filtered.length === 0) {
      return {
        totalPnl: 0,
        winRate: 0,
        profitFactor: 0,
        tradesCount: 0,
        equityCurve: [] as { i: number; equity: number; date: string }[],
      };
    }
    const wins = filtered.filter((tr) => (tr.pnl ?? 0) > 0);
    const losses = filtered.filter((tr) => (tr.pnl ?? 0) < 0);
    const totalPnl = filtered.reduce((s, tr) => s + (tr.pnl ?? 0), 0);
    const winRate = (wins.length / filtered.length) * 100;
    const grossWin = wins.reduce((s, tr) => s + (tr.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, tr) => s + (tr.pnl ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

    let equity = 0;
    const equityCurve = filtered.map((tr, i) => {
      equity += tr.pnl ?? 0;
      return { i, equity, date: tr.closed_at?.slice(0, 10) ?? "" };
    });

    return {
      totalPnl,
      winRate,
      profitFactor,
      tradesCount: filtered.length,
      equityCurve,
    };
  }, [filtered]);

  const presets: { key: PresetKey; label: string }[] = [
    { key: "7d", label: t("analytics.range.7d") },
    { key: "30d", label: t("analytics.range.30d") },
    { key: "90d", label: t("analytics.range.90d") },
    { key: "ytd", label: t("analytics.range.ytd") },
    { key: "all", label: t("analytics.range.all") },
  ];

  const rangeLabel =
    range?.from && range?.to
      ? `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`
      : range?.from
      ? `${format(range.from, "dd MMM yyyy")} – …`
      : t("analytics.range.allTime");

  const formatPF = (v: number) => (v === Infinity ? "∞" : v.toFixed(2));

  const cards = [
    {
      label: t("analytics.kpi.totalPnl"),
      value: `${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}`,
      icon: stats.totalPnl >= 0 ? TrendingUp : TrendingDown,
      accent: stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: t("analytics.kpi.winRate"),
      value: `${stats.winRate.toFixed(1)}%`,
      icon: Target,
      accent: "text-primary",
    },
    {
      label: t("analytics.kpi.profitFactor"),
      value: formatPF(stats.profitFactor),
      icon: BarChart3,
      accent: stats.profitFactor >= 1.5 ? "text-emerald-400" : stats.profitFactor >= 1 ? "text-primary" : "text-red-400",
    },
    {
      label: t("analytics.kpi.trades"),
      value: String(stats.tradesCount),
      icon: Hash,
      accent: "text-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <Card className="card-glass p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">
            {t("analytics.range.label")}
          </span>
          {presets.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              onClick={() => applyPreset(p.key)}
              className={cn(
                "h-8 rounded-full text-xs",
                preset === p.key && "bg-primary text-primary-foreground hover:bg-primary/80",
              )}
            >
              {p.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={preset === "custom" ? "default" : "outline"}
                className={cn(
                  "h-8 rounded-full text-xs gap-1.5",
                  preset === "custom" && "bg-primary text-primary-foreground hover:bg-primary/80",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {t("analytics.range.custom")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  setPreset("custom");
                }}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="ml-auto text-xs text-muted-foreground font-mono">{rangeLabel}</span>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="card-glass p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className={`font-display text-2xl font-semibold tabular-nums ${c.accent}`}>
                {loading ? <span className="inline-block h-7 w-16 rounded skeleton-shimmer" /> : c.value}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Equity curve */}
      <Card className="card-glass p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground">
              {t("perf.title")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t("perf.subtitle")}</p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {stats.tradesCount} {t("perf.closedTrades")}
          </span>
        </div>
        <div className="h-[260px]">
          {loading ? (
            <div className="h-full w-full rounded-xl skeleton-shimmer" />
          ) : stats.equityCurve.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {t("perf.empty")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equityCurve}>
                <defs>
                  <linearGradient id="equityGradFiltered" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#equityGradFiltered)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsFilteredView;
