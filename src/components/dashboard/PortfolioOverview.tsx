import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  X,
  Plug,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMTAccount } from "@/hooks/useMTAccount";

interface Position {
  symbol: string;
  side: "long" | "short";
  size: number;
  entry: number;
  current: number;
  pnl?: number; // override (when from MT)
  pct?: number;
}

const MOCK_POSITIONS: Position[] = [
  { symbol: "EUR/USD", side: "long", size: 2.5, entry: 1.0832, current: 1.0867 },
  { symbol: "GBP/JPY", side: "short", size: 1.0, entry: 192.45, current: 191.86 },
  { symbol: "XAU/USD", side: "long", size: 0.5, entry: 2402.1, current: 2418.3 },
  { symbol: "USD/JPY", side: "short", size: 1.5, entry: 154.92, current: 154.61 },
  { symbol: "AUD/USD", side: "long", size: 2.0, entry: 0.6612, current: 0.6604 },
];

const MOCK_EQUITY_CURVE = [
  42, 45, 44, 47, 49, 48, 51, 53, 52, 56, 58, 57, 60, 62, 61, 64, 66, 65, 68, 71,
  73, 72, 75, 78, 76, 80, 82, 81, 85, 88,
];
const MOCK_ACCOUNT_EQUITY = 48211.27;

const fmtPrice = (n: number) => (n > 100 ? n.toFixed(2) : n.toFixed(5));

const calcPnl = (p: Position): { pnl: number; pct: number } => {
  if (p.pnl != null && p.pct != null) return { pnl: p.pnl, pct: p.pct };
  const dir = p.side === "long" ? 1 : -1;
  const diff = (p.current - p.entry) * dir;
  const pipMultiplier = p.symbol.includes("JPY") ? 100 : p.symbol.includes("XAU") ? 1 : 10000;
  const pips = diff * pipMultiplier;
  const pnl = pips * (p.symbol.includes("XAU") ? 100 : 10) * p.size;
  const pct = (diff / p.entry) * 100 * (p.side === "long" ? 1 : -1);
  return { pnl, pct };
};

const PortfolioOverview = () => {
  const { account, positions: mtPositions, snapshots, syncing, sync, refresh } = useMTAccount();
  const isConnected = !!account && account.status === "connected";

  const handleDisconnect = async () => {
    if (!account) return;
    if (!confirm("Disconnect this MetaTrader account? Your synced history will be removed.")) return;
    const { error } = await (supabase as any)
      .from("user_mt_accounts")
      .delete()
      .eq("id", account.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account disconnected");
    refresh();
  };

  // Map MT positions to local Position shape (or use mock when not connected)
  const livePositions: Position[] = useMemo(() => {
    if (isConnected && mtPositions.length > 0) {
      return mtPositions.map((mp) => ({
        symbol: mp.symbol,
        side: mp.side === "buy" ? "long" : "short",
        size: Number(mp.volume),
        entry: Number(mp.open_price),
        current: Number(mp.current_price ?? mp.open_price),
        pnl: Number(mp.profit ?? 0),
        pct:
          mp.current_price && mp.open_price
            ? ((Number(mp.current_price) - Number(mp.open_price)) /
                Number(mp.open_price)) *
              100 *
              (mp.side === "buy" ? 1 : -1)
            : 0,
      }));
    }
    return MOCK_POSITIONS;
  }, [isConnected, mtPositions]);

  const [positions, setPositions] = useState<Position[]>(livePositions);
  useEffect(() => setPositions(livePositions), [livePositions]);

  const accountEquity = isConnected && account?.equity ? Number(account.equity) : MOCK_ACCOUNT_EQUITY;

  const totalPnl = useMemo(
    () => positions.reduce((acc, p) => acc + calcPnl(p).pnl, 0),
    [positions]
  );
  const totalPct = useMemo(() => {
    const w = positions.reduce(
      (acc, p) => {
        const c = calcPnl(p);
        return { num: acc.num + c.pct * p.size, den: acc.den + p.size };
      },
      { num: 0, den: 0 }
    );
    return w.den ? w.num / w.den : 0;
  }, [positions]);

  // Equity curve from snapshots when available
  const equityValues = useMemo(() => {
    if (isConnected && snapshots.length >= 2) {
      return snapshots.map((s) => Number(s.equity));
    }
    return MOCK_EQUITY_CURVE;
  }, [isConnected, snapshots]);

  const spark = useMemo(() => {
    const w = 320;
    const h = 64;
    const max = Math.max(...equityValues);
    const min = Math.min(...equityValues);
    const range = max - min || 1;
    const step = w / Math.max(1, equityValues.length - 1);
    const pts = equityValues.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { d: `M ${pts.join(" L ")}`, w, h, last: equityValues[equityValues.length - 1], min, max, range };
  }, [equityValues]);

  const isUp = totalPnl >= 0;
  const closePosition = (symbol: string) =>
    setPositions((prev) => prev.filter((p) => p.symbol !== symbol));


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden shadow-[0_20px_60px_-30px_hsl(48_100%_51%/0.15)]"
    >
      {/* Connection status banner — only when MT account is connected */}
      {isConnected && account && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-emerald-500/[0.04] px-6 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(160_84%_50%)]" />
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-mono text-foreground truncate">
              <span className="font-bold text-emerald-400">Connected:</span>{" "}
              <span className="text-foreground">
                {account.broker_name} • {account.server_name}
              </span>
              <span className="text-muted-foreground">
                {" "}• #{account.login} •{" "}
                {account.last_synced_at
                  ? `Last synced ${formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}`
                  : "syncing…"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => sync()}
              disabled={syncing}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
              title="Re-sync this account"
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sync now
            </button>
            <Link
              to="/connect-mt"
              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-card/60 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              Manage
            </Link>
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/15 transition-colors"
              title="Disconnect MT account"
            >
              <Trash2 className="h-3 w-3" />
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Header with bigger equity sparkline */}
      <div className="flex items-start justify-between gap-6 border-b border-border/40 px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Briefcase className="h-3.5 w-3.5" />
            </div>
            <h2 className="font-heading text-sm font-semibold text-foreground tracking-wide">
              Portfolio Overview
            </h2>
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-primary">
              <span className="relative flex h-1 w-1">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1 w-1 rounded-full bg-primary" />
              </span>
              Live
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className={`font-mono text-3xl font-bold tabular-nums tracking-tight ${
                isUp ? "text-emerald-400" : "text-red-400"
              }`}
              style={{
                textShadow: isUp
                  ? "0 0 30px hsl(160 84% 50% / 0.35)"
                  : "0 0 30px hsl(0 84% 60% / 0.35)",
              }}
            >
              {isUp ? "+" : "−"}${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${
                isUp ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isUp ? "▲" : "▼"} {Math.abs(totalPct).toFixed(2)}%
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Open P&amp;L
            </span>
          </div>
        </div>

        {/* Bigger equity sparkline */}
        <div className="hidden md:flex items-end gap-3">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Equity 30D
            </div>
            <div className="font-mono text-sm font-bold text-foreground">
              ${accountEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
              {isConnected ? (account?.account_type === "live" ? "Live MT" : "Demo MT") : "▲ +12.4%"}
            </div>
          </div>
          <svg
            width={spark.w}
            height={spark.h}
            viewBox={`0 0 ${spark.w} ${spark.h}`}
            className="overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id="equity-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(48 100% 51%)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="hsl(48 100% 51%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${spark.d} L ${spark.w},${spark.h} L 0,${spark.h} Z`}
              fill="url(#equity-grad)"
            />
            <path
              d={spark.d}
              fill="none"
              stroke="hsl(48 100% 51%)"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 6px hsl(48 100% 51% / 0.45))" }}
            />
            {/* End dot */}
            {(() => {
              const cx = spark.w;
              const cy = spark.h - ((spark.last - spark.min) / spark.range) * spark.h;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill="hsl(48 100% 51%)"
                  style={{ filter: "drop-shadow(0 0 6px hsl(48 100% 51%))" }}
                />
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Positions table */}
      <div className="px-2 py-2">
        <div className="grid grid-cols-[1.3fr_0.7fr_0.6fr_0.85fr_0.85fr_1fr_0.7fr_0.8fr_36px] gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>Symbol</span>
          <span>Side</span>
          <span className="text-right">Size</span>
          <span className="text-right">Entry</span>
          <span className="text-right">Current</span>
          <span className="text-right">P&amp;L</span>
          <span className="text-right">%</span>
          <span className="text-right">% Equity</span>
          <span />
        </div>
        <div className="divide-y divide-border/30">
          {positions.map((p) => {
            const { pnl, pct } = calcPnl(p);
            const up = pnl >= 0;
            const isLong = p.side === "long";
            const notional = p.size * p.current * (p.symbol.includes("XAU") ? 100 : 100000);
            const equityPct = (notional / accountEquity) * 100;
            return (
              <div
                key={p.symbol}
                className="group grid grid-cols-[1.3fr_0.7fr_0.6fr_0.85fr_0.85fr_1fr_0.7fr_0.8fr_36px] gap-2 items-center px-4 py-3 hover:bg-muted/20 transition-colors rounded-lg"
              >
                <span className="font-heading text-xs font-semibold text-foreground">
                  {p.symbol}
                </span>
                <span
                  className={`inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${
                    isLong
                      ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                      : "bg-red-500/10 text-red-400 ring-1 ring-red-500/30"
                  }`}
                >
                  {isLong ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {p.side}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-foreground">
                  {p.size.toFixed(2)}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {fmtPrice(p.entry)}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-foreground">
                  {fmtPrice(p.current)}
                </span>
                <span
                  className={`text-right font-mono text-sm font-bold tabular-nums ${
                    up ? "text-emerald-400" : "text-red-400"
                  }`}
                  style={{
                    textShadow: up
                      ? "0 0 12px hsl(160 84% 50% / 0.4)"
                      : "0 0 12px hsl(0 84% 60% / 0.4)",
                  }}
                >
                  {up ? "+" : "−"}${Math.abs(pnl).toFixed(2)}
                </span>
                <span
                  className={`text-right font-mono text-xs font-semibold tabular-nums ${
                    up ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {up ? "+" : ""}
                  {pct.toFixed(2)}%
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {equityPct.toFixed(1)}%
                </span>
                <button
                  onClick={() => closePosition(p.symbol)}
                  aria-label={`Close ${p.symbol} position`}
                  className="opacity-0 group-hover:opacity-100 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 ring-1 ring-transparent hover:ring-red-500/30 transition-all"
                  title="Close position"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          {positions.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
              No open positions
            </div>
          )}
        </div>
      </div>

      {/* Footer link */}
      <div className="border-t border-border/40 px-6 py-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {isConnected ? (
            <>
              <span className="text-emerald-400">●</span> MT live • {positions.length} open
            </>
          ) : (
            <>{positions.length} open position{positions.length === 1 ? "" : "s"} • <span className="text-primary">demo data</span></>
          )}
        </span>
        <div className="flex items-center gap-3">
          {!isConnected && (
            <Link
              to="/connect-mt"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
            >
              <Plug className="h-3 w-3" />
              Connect MT4/5
            </Link>
          )}
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            View full analytics
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default PortfolioOverview;
