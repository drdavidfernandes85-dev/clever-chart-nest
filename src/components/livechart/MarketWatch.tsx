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
    if (isAutoRefreshAllowed()) load();
    const onManualRefresh = () => load();
    window.addEventListener("mt:refresh-quotes", onManualRefresh);
    const id = window.setInterval(() => {
      if (isAutoRefreshAllowed()) load();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("mt:refresh-quotes", onManualRefresh);
    };

  }, []);

  return (
    <div className="flex h-full flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-[#FFCD05]" />
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
            Market Watch
          </h3>
        </div>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
        ) : (
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-emerald-400">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
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
                className={`group grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-[3px] text-left border-b border-neutral-900/80 transition-colors ${
                  isActive
                    ? "bg-[#FFCD05]/12 border-l-2 border-l-[#FFCD05] pl-[6px]"
                    : "hover:bg-neutral-900/40 border-l-2 border-l-transparent"
                }`}
              >
                <span
                  className={`font-mono text-[10.5px] font-semibold truncate ${
                    isActive ? "text-[#FFCD05]" : "text-neutral-100"
                  }`}
                >
                  {label}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-neutral-200">
                  {price != null ? price.toLocaleString("en-US", { maximumFractionDigits: 5 }) : "—"}
                </span>
                <span
                  className={`font-mono text-[9.5px] tabular-nums w-12 text-right ${
                    chg == null
                      ? "text-neutral-500"
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
