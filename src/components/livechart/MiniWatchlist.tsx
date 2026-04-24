import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import {
  MARKET_UNIVERSE,
  fetchMarketQuotes,
  decimalsFor,
} from "@/lib/markets";

export interface WatchSymbol {
  label: string; // pretty, e.g. "EUR/USD"
  value: string; // TradingView symbol
}

interface Props {
  symbols: WatchSymbol[];
  active: string; // active TradingView value
  onSelect: (value: string) => void;
}

interface Quote {
  price: number;
  open: number;
}

/**
 * Compact horizontal watchlist that sits above the chart for one-click symbol
 * switching. Shows live price + intraday/24h % change for crypto, forex,
 * indices and stocks via the shared `fetch-market-quotes` edge function.
 */
const MiniWatchlist = ({ symbols, active, onSelect }: Props) => {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const live = await fetchMarketQuotes();
      if (cancelled) return;
      setQuotes((prev) => {
        const next = { ...prev };
        for (const s of symbols) {
          const q = live.find((qq) => qq.symbol === s.label);
          if (!q || q.price == null || !Number.isFinite(q.price)) continue;
          const chg = q.changePct ?? 0;
          const open = chg ? q.price / (1 + chg / 100) : next[s.label]?.open ?? q.price;
          next[s.label] = { price: q.price, open };
        }
        return next;
      });
    };
    refresh();
    const id = window.setInterval(refresh, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbols]);

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-background/40 overflow-x-auto scrollbar-thin">
      <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border/30 shrink-0">
        <Star className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Watchlist
        </span>
      </div>
      {symbols.map((s) => {
        const asset = MARKET_UNIVERSE.find((m) => m.symbol === s.label);
        const q = quotes[s.label];
        const isActive = active === s.value;
        const change = q ? q.price - q.open : 0;
        const changePct = q && q.open ? (change / q.open) * 100 : 0;
        const isUp = change >= 0;
        const decimals = asset ? decimalsFor(asset, q?.price ?? null) : 2;
        return (
          <motion.button
            key={s.value}
            type="button"
            onClick={() => onSelect(s.value)}
            whileHover={{ y: -1 }}
            className={`group shrink-0 flex flex-col items-start gap-0.5 rounded-xl border px-3 py-1.5 transition-all ${
              isActive
                ? "border-primary/60 bg-primary/10 shadow-[0_0_18px_-6px_hsl(187_100%_50%/0.5)]"
                : "border-border/40 bg-card/50 hover:border-primary/40 hover:bg-card/80"
            }`}
          >
            <span
              className={`font-heading text-[11px] font-bold tracking-wide ${
                isActive ? "text-primary" : "text-foreground"
              }`}
            >
              {s.label}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] tabular-nums text-foreground">
                {q ? q.price.toFixed(decimals) : "—"}
              </span>
              <span
                className={`flex items-center gap-0.5 font-mono text-[10px] tabular-nums ${
                  isUp ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isUp ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {q ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default MiniWatchlist;
