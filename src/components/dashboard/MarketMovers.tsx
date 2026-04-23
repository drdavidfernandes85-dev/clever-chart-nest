import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Loader2 } from "lucide-react";

interface Mover {
  symbol: string;
  price: number;
  changePct: number;
  volume?: string;
}

// Pairs we monitor for movers — daily-volume rank (BIS Triennial) for "Most Active"
const PAIRS: Array<{ symbol: string; base: string; quote: string; volume: string }> = [
  { symbol: "EUR/USD", base: "EUR", quote: "USD", volume: "6.6T" },
  { symbol: "USD/JPY", base: "USD", quote: "JPY", volume: "1.7T" },
  { symbol: "GBP/USD", base: "GBP", quote: "USD", volume: "1.3T" },
  { symbol: "AUD/USD", base: "AUD", quote: "USD", volume: "0.9T" },
  { symbol: "USD/CAD", base: "USD", quote: "CAD", volume: "0.7T" },
  { symbol: "USD/CHF", base: "USD", quote: "CHF", volume: "0.6T" },
  { symbol: "NZD/USD", base: "NZD", quote: "USD", volume: "0.4T" },
  { symbol: "XAU/USD", base: "XAU", quote: "USD", volume: "0.3T" },
  { symbol: "GBP/JPY", base: "GBP", quote: "JPY", volume: "0.3T" },
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
  const [data, setData] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch live spot price + yesterday's close, derive 24h % change.
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const next = await Promise.all(
        PAIRS.map(async (p) => {
          try {
            const [latestRes, histRes] = await Promise.all([
              fetch(
                `https://api.exchangerate.host/latest?base=${p.base}&symbols=${p.quote}`,
                { cache: "no-store" },
              ),
              fetch(
                `https://api.exchangerate.host/${yesterday}?base=${p.base}&symbols=${p.quote}`,
                { cache: "no-store" },
              ),
            ]);
            const latest = await latestRes.json();
            const hist = await histRes.json();
            const price = latest?.rates?.[p.quote];
            const prev = hist?.rates?.[p.quote] ?? price;
            if (typeof price !== "number") return null;
            const changePct = prev ? ((price - prev) / prev) * 100 : 0;
            return {
              symbol: p.symbol,
              price,
              changePct,
              volume: p.volume,
            } as Mover;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setData(next.filter(Boolean) as Mover[]);
        setLoading(false);
      }
    };
    fetchAll();
    const id = window.setInterval(fetchAll, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const gainers = useMemo(
    () => [...data].sort((a, b) => b.changePct - a.changePct).slice(0, 4),
    [data],
  );
  const losers = useMemo(
    () => [...data].sort((a, b) => a.changePct - b.changePct).slice(0, 4),
    [data],
  );
  const mostActive = useMemo(
    () =>
      [...data]
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 4),
    [data],
  );

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
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {loading ? "Loading…" : "Live · 24h"}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MoverList title="Top Gainers" rows={gainers} variant="gainers" />
        <MoverList title="Top Losers" rows={losers} variant="losers" />
        <MoverList title="Most Active" rows={mostActive} variant="active" showVolume />
      </div>
    </motion.section>
  );
};

export default MarketMovers;
