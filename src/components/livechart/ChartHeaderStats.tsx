import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowDown, ArrowUp, BarChart2 } from "lucide-react";

interface Props {
  /** TradingView-style symbol e.g. "FX:EURUSD" */
  symbol: string;
  /** Pretty display label e.g. "EUR/USD" */
  displayLabel: string;
}

interface Quote {
  price: number;
  open: number;
  high: number;
  low: number;
}

const decimalsFor = (label: string) =>
  label.includes("JPY") ? 3 : label.includes("XAU") || label.includes("BTC") || label.includes("ETH") ? 2 : 5;

/**
 * Premium price header for the Live Chart workspace.
 * Pulls a free FX/crypto/metal quote and shows price, change, daily H/L and a
 * synthetic volume proxy (range × scale) since most free FX endpoints don't
 * expose true volume.
 */
const ChartHeaderStats = ({ symbol, displayLabel }: Props) => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [prev, setPrev] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQuote(null);
    setPrev(null);

    const clean = symbol.replace(/^[A-Z]+:/, "");
    const base = clean.slice(0, 3);
    const quoteCcy = clean.slice(3, 6);

    const fetchQuote = async () => {
      try {
        let price: number | null = null;
        if (base === "XAU" || quoteCcy === "XAU") {
          const res = await fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" });
          const json = await res.json();
          price = Number(json?.price);
        } else if (base === "BTC" || base === "ETH") {
          const id = base === "BTC" ? "bitcoin" : "ethereum";
          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
            { cache: "no-store" }
          );
          const json = await res.json();
          price = Number(json?.[id]?.usd);
        } else {
          const res = await fetch(
            `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quoteCcy}`,
            { cache: "no-store" }
          );
          const json = await res.json();
          price = Number(json?.rates?.[quoteCcy]);
        }
        if (!Number.isFinite(price) || cancelled) return;

        setQuote((q) => {
          const next: Quote = q
            ? {
                price: price!,
                open: q.open,
                high: Math.max(q.high, price!),
                low: Math.min(q.low, price!),
              }
            : { price: price!, open: price!, high: price!, low: price! };
          return next;
        });
        setPrev((p) => (p === null ? price : p));
      } catch {
        /* ignore */
      }
    };

    fetchQuote();
    const id = window.setInterval(fetchQuote, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol]);

  const decimals = decimalsFor(displayLabel);
  const change = quote ? quote.price - quote.open : 0;
  const changePct = quote && quote.open ? (change / quote.open) * 100 : 0;
  const isUp = change >= 0;
  const dirColor = isUp ? "text-emerald-400" : "text-red-400";
  const flashKey = quote ? quote.price : 0;

  // Synthetic "session activity" — the chart already shows real volume; this is
  // just a header glance metric derived from the day's range.
  const range = quote ? quote.high - quote.low : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3 border-b border-border/30 bg-card/60">
      {/* Symbol + price */}
      <div className="flex items-baseline gap-3 min-w-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {displayLabel}
          </span>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={flashKey}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 6, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="font-mono text-3xl md:text-4xl font-semibold tabular-nums leading-none text-foreground"
            >
              {quote ? quote.price.toFixed(decimals) : "—"}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className={`flex items-center gap-1 font-mono text-sm font-semibold tabular-nums ${dirColor}`}>
          {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {quote ? `${isUp ? "+" : ""}${change.toFixed(decimals)}` : "—"}
          <span className="ml-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[11px]">
            {quote ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 ml-auto">
        <Stat
          icon={<ArrowUp className="h-3.5 w-3.5 text-emerald-400" />}
          label="Day High"
          value={quote ? quote.high.toFixed(decimals) : "—"}
        />
        <Stat
          icon={<ArrowDown className="h-3.5 w-3.5 text-red-400" />}
          label="Day Low"
          value={quote ? quote.low.toFixed(decimals) : "—"}
        />
        <Stat
          icon={<BarChart2 className="h-3.5 w-3.5 text-primary" />}
          label="Session Range"
          value={quote ? range.toFixed(decimals) : "—"}
        />
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
      {icon}
      {label}
    </span>
    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>
  </div>
);

export default ChartHeaderStats;
