import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Target, ShieldAlert, CheckCircle, XCircle, Clock, MoreHorizontal, LayoutGrid, Rows3, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import NewSignalForm from "@/components/signals/NewSignalForm";
import SEO from "@/components/SEO";
import CopyTradeModal, { CopyTradeRequest } from "@/components/copytrade/CopyTradeModal";
import CopiedTradesHistory from "@/components/copytrade/CopiedTradesHistory";
import { useCopiedSignals } from "@/hooks/useCopiedSignals";

interface Signal {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  author_id: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  active: { icon: <Clock className="h-3 w-3" />, label: "Active", color: "bg-primary/20 text-primary border-primary/30" },
  hit_tp: { icon: <CheckCircle className="h-3 w-3" />, label: "TP Hit ✅", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  hit_sl: { icon: <XCircle className="h-3 w-3" />, label: "SL Hit ❌", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  cancelled: { icon: <ShieldAlert className="h-3 w-3" />, label: "Cancelled", color: "bg-muted text-muted-foreground border-border" },
};

const TradingSignals = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const copied = useCopiedSignals();
  const [request, setRequest] = useState<CopyTradeRequest | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [view, setView] = useState<"cards" | "grid">("cards");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchSignals = async () => {
      const { data } = await supabase
        .from("trading_signals")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setSignals(data);
      setLoading(false);
    };
    fetchSignals();

    const channel = supabase
      .channel("signals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "trading_signals" }, () => {
        fetchSignals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const checkRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "moderator"]);
      setIsAdmin(!!(data && data.length > 0));
    };
    checkRole();
  }, [user]);

  const activeSignals = signals.filter((s) => s.status === "active");
  const closedSignals = signals.filter((s) => s.status !== "active");
  const displayed = tab === "active" ? activeSignals : closedSignals;

  // P&L calculations — TP Hit = always positive pips, SL Hit = always negative
  const pnlStats = closedSignals.reduce(
    (acc, signal) => {
      const isJpy = signal.pair.includes("JPY");
      const pipMul = isJpy ? 100 : 10000;

      if (signal.status === "hit_tp" && signal.take_profit) {
        const pips = Math.abs(Number(signal.take_profit) - signal.entry_price) * pipMul;
        acc.totalPips += pips;
        acc.wins += 1;
      } else if (signal.status === "hit_sl" && signal.stop_loss) {
        const pips = Math.abs(Number(signal.stop_loss) - signal.entry_price) * pipMul;
        acc.totalPips -= pips;
        acc.losses += 1;
      }
      return acc;
    },
    { totalPips: 0, wins: 0, losses: 0 }
  );
  const winRate = pnlStats.wins + pnlStats.losses > 0
    ? ((pnlStats.wins / (pnlStats.wins + pnlStats.losses)) * 100).toFixed(0)
    : null;

  // Chart data: cumulative P&L over time
  const chartData = useMemo(() => {
    const closed = closedSignals
      .filter((s) => s.status === "hit_tp" || s.status === "hit_sl")
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

    let cumPips = 0;
    return closed.map((signal) => {
      const isJpy = signal.pair.includes("JPY");
      const pipMul = isJpy ? 100 : 10000;

      if (signal.status === "hit_tp" && signal.take_profit) {
        cumPips += Math.abs(Number(signal.take_profit) - signal.entry_price) * pipMul;
      } else if (signal.status === "hit_sl" && signal.stop_loss) {
        cumPips -= Math.abs(Number(signal.stop_loss) - signal.entry_price) * pipMul;
      }

      return {
        date: new Date(signal.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pips: parseFloat(cumPips.toFixed(1)),
        pair: signal.pair,
        status: signal.status,
      };
    });
  }, [closedSignals]);

  const updateStatus = async (signalId: string, newStatus: string) => {
    const { error } = await supabase
      .from("trading_signals")
      .update({ status: newStatus })
      .eq("id", signalId);
    if (error) {
      toast.error("Failed to update signal status");
    } else {
      toast.success(`Signal marked as ${statusConfig[newStatus]?.label || newStatus}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <SEO
        title="Trading Signals | Elite Live Trading Room"
        description="Live and historical forex signals from the Elite Live Trading Room moderators with entry, stop and target."
        canonical="https://elitelivetradingroom.com/signals"
      />
      <div className="container max-w-4xl py-24">
        <div className="mb-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground gap-1">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> {t("nav.home")}</Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground uppercase tracking-tight">
            {t("signals.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("signals.desc")}</p>
        </div>

        {/* P&L Tracker */}
        {closedSignals.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl border border-border/30 bg-card p-4 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">Total P&L</span>
                <span className={`text-xl font-heading font-bold ${pnlStats.totalPips >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {pnlStats.totalPips >= 0 ? "+" : ""}{pnlStats.totalPips.toFixed(1)}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1">pips</span>
              </div>
              <div className="rounded-xl border border-border/30 bg-card p-4 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">Win Rate</span>
                <span className="text-xl font-heading font-bold text-foreground">
                  {winRate !== null ? `${winRate}%` : "—"}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <span className="text-[10px] text-emerald-400/70 uppercase block mb-1">Wins</span>
                <span className="text-xl font-heading font-bold text-emerald-400">{pnlStats.wins}</span>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                <span className="text-[10px] text-red-400/70 uppercase block mb-1">Losses</span>
                <span className="text-xl font-heading font-bold text-red-400">{pnlStats.losses}</span>
              </div>
            </div>

            {/* P&L Chart */}
            {chartData.length >= 2 && (
              <div className="rounded-xl border border-border/30 bg-card p-5 mb-6">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Cumulative P&L (pips)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [`${value > 0 ? "+" : ""}${value} pips`, "P&L"]}
                      labelFormatter={(label) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="pips"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#pnlGradientPos)"
                      dot={{ r: 3, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {isAdmin && <NewSignalForm />}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setTab("active")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === "active" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t("signals.active")} ({activeSignals.length})
          </button>
          <button
            onClick={() => setTab("closed")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === "closed" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t("signals.closed")} ({closedSignals.length})
          </button>
          {/* Layout toggle — Cards vs dense Grid (Bloomberg-style) */}
          <div className="ml-auto flex items-center gap-1 rounded-full border border-border/40 bg-muted/30 p-0.5">
            <button
              onClick={() => setView("cards")}
              aria-label="Card view"
              title="Card view"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                view === "cards" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </button>
            <button
              onClick={() => setView("grid")}
              aria-label="Dense grid view"
              title="Dense grid view"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                view === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Rows3 className="h-3.5 w-3.5" /> Grid
            </button>
          </div>
        </div>

        {/* Signals */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/30 bg-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </div>
                <div className="flex gap-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{t("signals.empty")}</p>
          </div>
        ) : view === "grid" ? (
          <div className="overflow-hidden rounded-2xl border border-border/40 glass-panel">
            <div className="max-h-[70vh] overflow-auto">
              <Table className="font-mono text-[12px]">
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="h-9 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Pair</TableHead>
                    <TableHead className="h-9 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Side</TableHead>
                    <TableHead className="h-9 text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Entry</TableHead>
                    <TableHead className="h-9 text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">SL</TableHead>
                    <TableHead className="h-9 text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">TP</TableHead>
                    <TableHead className="h-9 text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Risk</TableHead>
                    <TableHead className="h-9 text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Reward</TableHead>
                    <TableHead className="h-9 text-right text-[10px] uppercase tracking-[0.15em] text-muted-foreground">R:R</TableHead>
                    <TableHead className="h-9 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Status</TableHead>
                    <TableHead className="h-9 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Time</TableHead>
                    {isAdmin && <TableHead className="h-9 w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.map((signal) => {
                    const sc = statusConfig[signal.status] || statusConfig.active;
                    const isBuy = signal.direction === "buy";
                    const isJpy = signal.pair.includes("JPY");
                    const pipMul = isJpy ? 100 : 10000;
                    const slPips = signal.stop_loss
                      ? Math.abs(signal.entry_price - Number(signal.stop_loss)) * pipMul
                      : null;
                    const tpPips = signal.take_profit
                      ? Math.abs(Number(signal.take_profit) - signal.entry_price) * pipMul
                      : null;
                    const rr = slPips && tpPips ? tpPips / slPips : null;
                    return (
                      <TableRow
                        key={signal.id}
                        className="border-border/20 hover:bg-primary/5 transition-colors"
                      >
                        <TableCell className="py-2 font-heading text-sm font-bold text-foreground">{signal.pair}</TableCell>
                        <TableCell className="py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              isBuy
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isBuy ? "BUY" : "SELL"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-foreground">{Number(signal.entry_price).toFixed(5)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-red-400/90">{signal.stop_loss ? Number(signal.stop_loss).toFixed(5) : "—"}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-emerald-400/90">{signal.take_profit ? Number(signal.take_profit).toFixed(5) : "—"}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-red-400/80">{slPips !== null ? `${slPips.toFixed(1)}p` : "—"}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-emerald-400/80">{tpPips !== null ? `${tpPips.toFixed(1)}p` : "—"}</TableCell>
                        <TableCell className="py-2 text-right">
                          {rr !== null ? (
                            <span
                              className={`tabular-nums font-semibold ${
                                rr >= 2
                                  ? "text-emerald-400"
                                  : rr >= 1
                                  ? "text-primary"
                                  : "text-red-400"
                              }`}
                            >
                              {rr.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-[10px] text-muted-foreground">
                          {new Date(signal.created_at).toLocaleString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="py-2">
                            {signal.status === "active" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => updateStatus(signal.id, "hit_tp")} className="gap-2 text-emerald-400">
                                    <CheckCircle className="h-3.5 w-3.5" /> Mark TP Hit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatus(signal.id, "hit_sl")} className="gap-2 text-red-400">
                                    <XCircle className="h-3.5 w-3.5" /> Mark SL Hit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatus(signal.id, "cancelled")} className="gap-2 text-muted-foreground">
                                    <ShieldAlert className="h-3.5 w-3.5" /> Cancel Signal
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map((signal) => {
              const sc = statusConfig[signal.status] || statusConfig.active;
              const isBuy = signal.direction === "buy";

              // Calculate pips (for JPY pairs use 100, others use 10000)
              const isJpy = signal.pair.includes("JPY");
              const pipMultiplier = isJpy ? 100 : 10000;
              const slPips = signal.stop_loss
                ? Math.abs(signal.entry_price - Number(signal.stop_loss)) * pipMultiplier
                : null;
              const tpPips = signal.take_profit
                ? Math.abs(Number(signal.take_profit) - signal.entry_price) * pipMultiplier
                : null;
              const rr = slPips && tpPips ? (tpPips / slPips) : null;

              return (
                <div
                  key={signal.id}
                  className={`rounded-2xl border bg-card p-5 transition-all hover:shadow-md ${
                    signal.status === "active"
                      ? "border-primary/20 hover:border-primary/40"
                      : "border-border/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-heading text-lg font-bold text-foreground">{signal.pair}</span>
                      <Badge
                        className={`text-[10px] font-bold uppercase gap-1 ${
                          isBuy
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        }`}
                        variant="outline"
                      >
                        {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isBuy ? t("signals.buy") : t("signals.sell")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] gap-1 ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </Badge>
                      {isAdmin && signal.status === "active" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(signal.id, "hit_tp")} className="gap-2 text-emerald-400">
                              <CheckCircle className="h-3.5 w-3.5" /> Mark TP Hit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(signal.id, "hit_sl")} className="gap-2 text-red-400">
                              <XCircle className="h-3.5 w-3.5" /> Mark SL Hit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(signal.id, "cancelled")} className="gap-2 text-muted-foreground">
                              <ShieldAlert className="h-3.5 w-3.5" /> Cancel Signal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">{t("signals.entry")}</span>
                      <span className="text-sm font-mono font-semibold text-foreground">{Number(signal.entry_price).toFixed(5)}</span>
                    </div>
                    {signal.stop_loss && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">{t("signals.sl")}</span>
                        <span className="text-sm font-mono font-semibold text-red-400">{Number(signal.stop_loss).toFixed(5)}</span>
                        {slPips !== null && (
                          <span className="text-[10px] text-red-400/70 ml-1">({slPips.toFixed(1)} pips)</span>
                        )}
                      </div>
                    )}
                    {signal.take_profit && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">{t("signals.tp")}</span>
                        <span className="text-sm font-mono font-semibold text-emerald-400">{Number(signal.take_profit).toFixed(5)}</span>
                        {tpPips !== null && (
                          <span className="text-[10px] text-emerald-400/70 ml-1">({tpPips.toFixed(1)} pips)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Risk/Reward row */}
                  {(slPips || tpPips || rr) && (
                    <div className="flex items-center gap-4 mb-3 text-[11px]">
                      {slPips !== null && (
                        <span className="text-muted-foreground">Risk: <span className="font-semibold text-red-400">{slPips.toFixed(1)} pips</span></span>
                      )}
                      {tpPips !== null && (
                        <span className="text-muted-foreground">Reward: <span className="font-semibold text-emerald-400">{tpPips.toFixed(1)} pips</span></span>
                      )}
                      {rr !== null && (
                        <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                          rr >= 2 ? "bg-emerald-500/20 text-emerald-400" : rr >= 1 ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-400"
                        }`}>
                          R:R {rr.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                  {signal.notes && (
                    <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/20 pt-3 mt-1">
                      {signal.notes}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(signal.created_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    {signal.status === "active" && (
                      <button
                        onClick={() =>
                          openTrade({
                            symbol: signal.pair,
                            side: isBuy ? "buy" : "sell",
                            lots: "0.10",
                            sl: signal.stop_loss != null ? String(signal.stop_loss) : undefined,
                            tp: signal.take_profit != null ? String(signal.take_profit) : undefined,
                            signalId: signal.id,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 shadow-[0_8px_25px_-10px_hsl(48_100%_51%/0.6)] transition-colors"
                      >
                        <Zap className="h-3 w-3" />
                        Take This Signal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Floating Quick Trade panel — only renders when openTrade() has been triggered */}
      <SignalsQuickTradeMount />
    </div>
  );
};

// Render QuickTradePanel as a floating modal whenever the global Quick Trade
// context is open, so users on /signals can take signals without leaving the page.
const SignalsQuickTradeMount = () => {
  const { open, close } = useQuickTrade();
  if (!open) return null;
  return (
    <>
      <div
        onClick={close}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2">
        <QuickTradePanel compact />
      </div>
    </>
  );
};

export default TradingSignals;
