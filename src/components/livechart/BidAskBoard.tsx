import { Bookmark, Loader2 } from "lucide-react";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";

interface Props {
  /** Broker symbol names (e.g. "EURUSD", "XAUUSD"). */
  symbols: string[];
  onSelect?: (label: string) => void;
  activeSymbol?: string;
}

/**
 * Compact institutional Bid / Ask / Last / 24h % board.
 * Powered by the shared useMultiSymbolTicks hook which polls
 * `get-mt5-terminal-data` sequentially every 2.5s.
 */
const BidAskBoard = ({ symbols, onSelect, activeSymbol }: Props) => {
  const rows = useMultiSymbolTicks(symbols);
  const anyLoaded = Object.keys(rows).length > 0;

  return (
    <div className="rounded-md border border-neutral-800/80 bg-[#0f0f0f] overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <Bookmark className="h-3.5 w-3.5 text-[#FFCD05]" />
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
            Bid / Ask Board
          </h3>
        </div>
        {anyLoaded ? (
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-[#FFCD05]" />
        )}
      </div>
      <div className="grid grid-cols-[1fr_72px_72px_72px_56px] items-center gap-1 border-b border-neutral-800/80 bg-[#0a0a0a] px-3 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500">
        <span>Symbol</span>
        <span className="text-right">Bid</span>
        <span className="text-right">Last</span>
        <span className="text-right">Ask</span>
        <span className="text-right">24H %</span>
      </div>
      <ul className="divide-y divide-neutral-800/60 max-h-[280px] overflow-y-auto">
        {symbols.map((sym) => {
          const r = rows[sym];
          const digits = r?.digits ?? 5;
          const isActive = activeSymbol?.toUpperCase() === sym.toUpperCase();
          const fmt = (v: number | null | undefined) =>
            v == null
              ? "—"
              : v.toLocaleString("en-US", {
                  minimumFractionDigits: digits,
                  maximumFractionDigits: digits,
                });
          const pct = r?.changePct;
          const pctClass =
            pct == null
              ? "text-neutral-500"
              : pct >= 0
                ? "text-emerald-400"
                : "text-red-400";
          return (
            <li key={sym}>
              <button
                type="button"
                onClick={() => onSelect?.(sym)}
                className={`w-full grid grid-cols-[1fr_72px_72px_72px_56px] items-center gap-1 px-3 py-1.5 text-left transition-colors ${
                  isActive ? "bg-[#FFCD05]/10" : "hover:bg-neutral-900/60"
                }`}
              >
                <span className={`font-mono text-[11px] font-semibold ${isActive ? "text-[#FFCD05]" : "text-neutral-100"}`}>
                  {sym}
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-red-400">
                  {fmt(r?.bid)}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-neutral-400">
                  {fmt(r?.last)}
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-emerald-400">
                  {fmt(r?.ask)}
                </span>
                <span className={`text-right font-mono text-[10px] tabular-nums ${pctClass}`}>
                  {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BidAskBoard;
