import { useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { fetchMarketQuotes, type LiveQuote } from "@/lib/markets";

interface Props {
  symbols: string[]; // display labels
  onSelect?: (label: string) => void;
}

/**
 * Multi-pair Bid/Ask board (Nelogica BlackArrow style).
 * Uses live `fetch-market-quotes` prices and derives a typical spread per
 * asset class for display. Refreshes every 3s.
 */
const SPREADS: Record<string, number> = {
  // pip / point fraction by symbol family — typical broker spread
  forex: 0.00008,
  jpy: 0.008,
  metal: 0.15,
  index: 0.5,
  crypto: 0.5,
  stock: 0.02,
};

function classify(label: string): keyof typeof SPREADS {
  const u = label.toUpperCase();
  if (u.includes("JPY")) return "jpy";
  if (u.includes("XAU") || u.includes("GOLD") || u.includes("XAG") || u.includes("SILVER")) return "metal";
  if (/^(US30|NAS100|SPX500|GER40|DAX|S&P|NASDAQ|DOW|FTSE|NIKKEI)/i.test(label)) return "index";
  if (u.includes("BTC") || u.includes("ETH") || u.includes("SOL") || u.includes("USDT")) return "crypto";
  if (/^[A-Z]{3}\/?[A-Z]{3}$/i.test(label)) return "forex";
  return "stock";
}

const BidAskBoard = ({ symbols, onSelect }: Props) => {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});

  useEffect(() => {
    let cancelled = false;
    let prev: Record<string, number> = {};
    const load = async () => {
      const list = await fetchMarketQuotes();
      if (cancelled) return;
      const map: Record<string, LiveQuote> = {};
      const fl: Record<string, "up" | "down" | null> = {};
      for (const q of list) {
        const k = q.symbol.toUpperCase();
        map[k] = q;
        if (prev[k] != null && q.price != null) {
          if (q.price > prev[k]) fl[k] = "up";
          else if (q.price < prev[k]) fl[k] = "down";
        }
        if (q.price != null) prev[k] = q.price;
      }
      setQuotes(map);
      setFlash(fl);
      setLoading(false);
      window.setTimeout(() => setFlash({}), 700);
    };
    load();
    const id = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Bid / Ask Board
          </h3>
        </div>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border/30 bg-background/40 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>Symbol</span>
        <span className="w-16 text-right text-red-400">Bid</span>
        <span className="w-16 text-center text-foreground">Last</span>
        <span className="w-16 text-right text-emerald-400">Ask</span>
      </div>
      <ul className="divide-y divide-border/20 max-h-[260px] overflow-y-auto">
        {symbols.map((label) => {
          const q = quotes[label.toUpperCase()];
          const price = q?.price ?? null;
          const cls = classify(label);
          const spread = SPREADS[cls];
          const bid = price != null ? price - spread / 2 : null;
          const ask = price != null ? price + spread / 2 : null;
          const decimals =
            cls === "forex" ? 5 : cls === "jpy" ? 3 : cls === "crypto" ? 2 : 2;
          const fmt = (v: number | null) =>
            v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
          const f = flash[label.toUpperCase()];
          return (
            <li
              key={label}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors ${
                f === "up" ? "bg-emerald-500/10" : f === "down" ? "bg-red-500/10" : ""
              }`}
              onClick={() => onSelect?.(label)}
            >
              <span className="font-mono text-[11px] font-semibold text-foreground">{label}</span>
              <span className="w-16 text-right font-mono text-[11px] tabular-nums text-red-400">{fmt(bid)}</span>
              <span className="w-16 text-center font-mono text-[10px] tabular-nums text-muted-foreground">{fmt(price)}</span>
              <span className="w-16 text-right font-mono text-[11px] tabular-nums text-emerald-400">{fmt(ask)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BidAskBoard;
