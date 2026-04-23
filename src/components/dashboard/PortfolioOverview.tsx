import { useMemo } from "react";
import { motion } from "framer-motion";
import { Briefcase, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Position {
  symbol: string;
  side: "long" | "short";
  size: number; // lots
  entry: number;
  current: number;
}

const POSITIONS: Position[] = [
  { symbol: "EUR/USD", side: "long", size: 2.5, entry: 1.0832, current: 1.0867 },
  { symbol: "GBP/JPY", side: "short", size: 1.0, entry: 192.45, current: 191.86 },
  { symbol: "XAU/USD", side: "long", size: 0.5, entry: 2402.1, current: 2418.3 },
  { symbol: "USD/JPY", side: "short", size: 1.5, entry: 154.92, current: 154.61 },
  { symbol: "AUD/USD", side: "long", size: 2.0, entry: 0.6612, current: 0.6604 },
];

// Equity curve sparkline points (last 30 ticks, normalized 0..100)
const EQUITY = [
  42, 45, 44, 47, 49, 48, 51, 53, 52, 56, 58, 57, 60, 62, 61, 64, 66, 65, 68, 71,
  73, 72, 75, 78, 76, 80, 82, 81, 85, 88,
];

const fmtPrice = (n: number) => (n > 100 ? n.toFixed(2) : n.toFixed(5));

const calcPnl = (p: Position): { pnl: number; pct: number } => {
  const dir = p.side === "long" ? 1 : -1;
  const diff = (p.current - p.entry) * dir;
  const pipMultiplier = p.symbol.includes("JPY") ? 100 : p.symbol.includes("XAU") ? 1 : 10000;
  const pips = diff * pipMultiplier;
  // Approx: 1 pip ≈ $10 per standard lot for most majors
  const pnl = pips * (p.symbol.includes("XAU") ? 100 : 10) * p.size;
  const pct = (diff / p.entry) * 100 * (p.side === "long" ? 1 : -1);
  return { pnl, pct };
};

const PortfolioOverview = () => {
  const totalPnl = useMemo(
    () => POSITIONS.reduce((acc, p) => acc + calcPnl(p).pnl, 0),
    []
  );
  const totalPct = useMemo(() => {
    const w = POSITIONS.reduce(
      (acc, p) => {
        const c = calcPnl(p);
        return { num: acc.num + c.pct * p.size, den: acc.den + p.size };
      },
      { num: 0, den: 0 }
    );
    return w.den ? w.num / w.den : 0;
  }, []);

  // Build sparkline path
  const spark = useMemo(() => {
    const w = 220;
    const h = 44;
    const max = Math.max(...EQUITY);
    const min = Math.min(...EQUITY);
    const range = max - min || 1;
    const step = w / (EQUITY.length - 1);
    const pts = EQUITY.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { d: `M ${pts.join(" L ")}`, w, h };
  }, []);

  const isUp = totalPnl >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header with equity sparkline */}
      <div className="flex items-start justify-between gap-6 border-b border-border/40 px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
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
              className={`font-mono text-2xl font-semibold tabular-nums ${
                isUp ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isUp ? "+" : "−"}${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span
              className={`font-mono text-xs tabular-nums ${
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

        {/* Equity sparkline */}
        <div className="hidden md:flex items-end gap-3">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Equity 30D
            </div>
            <div className="font-mono text-xs font-semibold text-foreground">
              $48,211.27
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
                <stop offset="0%" stopColor="hsl(48 100% 51%)" stopOpacity="0.4" />
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
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Positions table */}
      <div className="px-2 py-2">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.9fr_0.9fr_1fr_1fr] gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>Symbol</span>
          <span>Side</span>
          <span className="text-right">Size</span>
          <span className="text-right">Entry</span>
          <span className="text-right">Current</span>
          <span className="text-right">P&amp;L</span>
          <span className="text-right">%</span>
        </div>
        <div className="divide-y divide-border/30">
          {POSITIONS.map((p) => {
            const { pnl, pct } = calcPnl(p);
            const up = pnl >= 0;
            const isLong = p.side === "long";
            return (
              <div
                key={p.symbol}
                className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.9fr_0.9fr_1fr_1fr] gap-2 items-center px-4 py-3 hover:bg-muted/20 transition-colors rounded-lg"
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
                  className={`text-right font-mono text-xs font-semibold tabular-nums ${
                    up ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {up ? "+" : "−"}${Math.abs(pnl).toFixed(2)}
                </span>
                <span
                  className={`text-right font-mono text-xs tabular-nums ${
                    up ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {up ? "+" : ""}
                  {pct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer link */}
      <div className="border-t border-border/40 px-6 py-3 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {POSITIONS.length} open positions
        </span>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          View full analytics
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  );
};

export default PortfolioOverview;
