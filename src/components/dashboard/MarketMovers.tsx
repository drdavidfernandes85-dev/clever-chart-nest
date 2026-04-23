import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface Mover {
  symbol: string;
  price: number;
  changePct: number;
  volume?: string;
}

const TOP_GAINERS: Mover[] = [
  { symbol: "XAU/USD", price: 2418.3, changePct: 1.84 },
  { symbol: "GBP/USD", price: 1.2784, changePct: 0.92 },
  { symbol: "EUR/USD", price: 1.0867, changePct: 0.41 },
  { symbol: "AUD/USD", price: 0.6604, changePct: 0.28 },
];

const TOP_LOSERS: Mover[] = [
  { symbol: "USD/JPY", price: 154.61, changePct: -0.62 },
  { symbol: "USD/CHF", price: 0.8842, changePct: -0.48 },
  { symbol: "NZD/USD", price: 0.6021, changePct: -0.31 },
  { symbol: "USD/CAD", price: 1.3712, changePct: -0.18 },
];

const MOST_ACTIVE: Mover[] = [
  { symbol: "EUR/USD", price: 1.0867, changePct: 0.41, volume: "2.4B" },
  { symbol: "USD/JPY", price: 154.61, changePct: -0.62, volume: "1.9B" },
  { symbol: "GBP/JPY", price: 191.86, changePct: 0.31, volume: "1.2B" },
  { symbol: "XAU/USD", price: 2418.3, changePct: 1.84, volume: "0.9B" },
];

const fmt = (n: number) => (n > 100 ? n.toFixed(2) : n.toFixed(4));

const MoverList = ({
  title,
  rows,
  variant,
  showVolume = false,
}: {
  title: string;
  rows: Mover[];
  variant: "gainers" | "losers" | "active";
  showVolume?: boolean;
}) => {
  const Icon =
    variant === "gainers" ? TrendingUp : variant === "losers" ? TrendingDown : Activity;
  const accent =
    variant === "gainers"
      ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30"
      : variant === "losers"
      ? "text-red-400 bg-red-500/10 ring-red-500/30"
      : "text-primary bg-primary/10 ring-primary/30";

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-md ring-1 ${accent}`}
          >
            <Icon className="h-2.5 w-2.5" />
          </div>
          <h3 className="font-heading text-[11px] font-semibold text-foreground tracking-wide uppercase">
            {title}
          </h3>
        </div>
        <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground">
          24H
        </span>
      </div>
      <ul className="divide-y divide-border/20">
        {rows.map((m) => {
          const up = m.changePct >= 0;
          return (
            <li
              key={m.symbol}
              className="flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-muted/20 transition-colors"
            >
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="font-heading text-[11px] font-semibold text-foreground">
                  {m.symbol}
                </span>
                {showVolume && m.volume && (
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {m.volume}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] tabular-nums text-foreground">
                  {fmt(m.price)}
                </span>
                <span
                  className={`font-mono text-[10px] font-semibold tabular-nums ${
                    up ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {up ? "+" : ""}
                  {m.changePct.toFixed(2)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const MarketMovers = () => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      aria-labelledby="market-movers-heading"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="market-movers-heading"
          className="font-heading text-sm font-semibold text-foreground tracking-wide"
        >
          Market Movers
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Last 24 hours
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MoverList title="Top Gainers" rows={TOP_GAINERS} variant="gainers" />
        <MoverList title="Top Losers" rows={TOP_LOSERS} variant="losers" />
        <MoverList title="Most Active" rows={MOST_ACTIVE} variant="active" showVolume />
      </div>
    </motion.section>
  );
};

export default MarketMovers;
