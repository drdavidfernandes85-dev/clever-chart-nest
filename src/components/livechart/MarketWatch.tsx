import { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { fetchMarketQuotes, type LiveQuote } from "@/lib/markets";
import { isAutoRefreshAllowed } from "@/lib/tradingLayerControl";

interface Props {
  symbols: string[]; // display labels e.g. "EUR/USD"
  active: string;
  onSelect: (label: string) => void;
}

/** Compact Market Watch rail (Nelogica-style). Live price + % change. */
const MarketWatch = ({ symbols, active, onSelect }: Props) => {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await fetchMarketQuotes();
      if (cancelled) return;
      const map: Record<string, LiveQuote> = {};
      for (const q of list) map[q.symbol.toUpperCase()] = q;
      setQuotes(map);
      setLoading(false);
    };
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Market Watch
          </h3>
        </div>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-border/20">
        {symbols.map((label) => {
          const q = quotes[label.toUpperCase()];
          const price = q?.price ?? null;
          const chg = q?.changePct ?? null;
          const isUp = (chg ?? 0) >= 0;
          const isActive = active === label;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onSelect(label)}
                className={`group grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 text-left transition-colors ${
                  isActive ? "bg-primary/10" : "hover:bg-muted/30"
                }`}
              >
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    isActive ? "text-primary" : "text-foreground"
                  }`}
                >
                  {label}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-foreground">
                  {price != null ? price.toLocaleString("en-US", { maximumFractionDigits: 5 }) : "—"}
                </span>
                <span
                  className={`font-mono text-[10px] tabular-nums w-12 text-right ${
                    chg == null
                      ? "text-muted-foreground"
                      : isUp
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {chg != null ? `${isUp ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MarketWatch;
