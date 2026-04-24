import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Loader2 } from "lucide-react";

interface Mover {
  symbol: string;
  price: number;
  changePct: number;
  volume?: string;
}

// Top crypto pairs we monitor for movers — all priced in USDT.
// `id` is the CoinGecko id used by /simple/price (free, no API key, CORS).
const PAIRS: Array<{ symbol: string; id: string; volume: string }> = [
  { symbol: "BTC/USDT",  id: "bitcoin",      volume: "32B" },
  { symbol: "ETH/USDT",  id: "ethereum",     volume: "18B" },
  { symbol: "SOL/USDT",  id: "solana",       volume: "4.2B" },
  { symbol: "SUI/USDT",  id: "sui",          volume: "1.8B" },
  { symbol: "TON/USDT",  id: "toncoin",      volume: "0.9B" },
  { symbol: "PEPE/USDT", id: "pepe",         volume: "1.4B" },
  { symbol: "WIF/USDT",  id: "dogwifcoin",   volume: "0.6B" },
  { symbol: "HYPE/USDT", id: "hyperliquid",  volume: "0.5B" },
  { symbol: "XRP/USDT",  id: "ripple",       volume: "2.1B" },
];

const fmt = (n: number) => {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(8);
};

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
        {rows.length === 0 && (
          <li className="px-3.5 py-6 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
            Loading…
          </li>
        )}
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

  // CoinGecko /simple/price returns spot + 24h % change in a single call.
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const ids = PAIRS.map((p) => p.id).join(",");
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("price feed");
        const json = await res.json();
        const next: Mover[] = PAIRS.map((p) => {
          const row = json?.[p.id];
          if (!row) return null;
          const price = Number(row.usd);
          const changePct = Number(row.usd_24h_change ?? 0);
          if (!Number.isFinite(price)) return null;
          return { symbol: p.symbol, price, changePct, volume: p.volume };
        }).filter(Boolean) as Mover[];
        if (!cancelled) {
          setData(next);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    // Polling every 60s — CoinGecko free tier allows ~30 calls/min.
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
