import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, TrendingUp, TrendingDown } from "lucide-react";

export interface WatchSymbol {
  label: string; // "EUR/USD"
  value: string; // "FX:EURUSD" — TradingView style
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

const decimalsFor = (label: string) =>
  label.includes("JPY") ? 3 : label.includes("XAU") || label.includes("BTC") || label.includes("ETH") ? 2 : 5;

const fetchQuote = async (label: string): Promise<number | null> => {
  const [base, quote] = label.split("/");
  if (!base || !quote) return null;
  try {
    if (base === "XAU" || quote === "XAU") {
      const r = await fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" });
      const j = await r.json();
      return Number(j?.price);
    }
    if (base === "BTC" || base === "ETH") {
      const id = base === "BTC" ? "bitcoin" : "ethereum";
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
        { cache: "no-store" }
      );
      const j = await r.json();
      return Number(j?.[id]?.usd);
    }
    const r = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`,
      { cache: "no-store" }
    );
    const j = await r.json();
    return Number(j?.rates?.[quote]);
  } catch {
    return null;
  }
};

/**
 * Compact horizontal watchlist that sits above the chart for one-click symbol
 * switching. Each tile shows live price + intraday % change.
 */
const MiniWatchlist = ({ symbols, active, onSelect }: Props) => {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const results = await Promise.all(
        symbols.map(async (s) => ({ label: s.label, price: await fetchQuote(s.label) }))
      );
      if (cancelled) return;
      setQuotes((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.price == null || !Number.isFinite(r.price)) continue;
          const existing = next[r.label];
          next[r.label] = existing
            ? { price: r.price, open: existing.open }
            : { price: r.price, open: r.price };
        }
        return next;
      });
    };
    refresh();
    const id = window.setInterval(refresh, 6000);
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
        const q = quotes[s.label];
        const isActive = active === s.value;
        const change = q ? q.price - q.open : 0;
        const changePct = q && q.open ? (change / q.open) * 100 : 0;
        const isUp = change >= 0;
        const decimals = decimalsFor(s.label);
        return (
          <motion.button
            key={s.value}
            type="button"
            onClick={() => onSelect(s.value)}
            whileHover={{ y: -1 }}
            className={`group shrink-0 flex flex-col items-start gap-0.5 rounded-xl border px-3 py-1.5 transition-all ${
              isActive
                ? "border-primary/60 bg-primary/10 shadow-[0_0_18px_-6px_hsl(48_100%_51%/0.5)]"
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
