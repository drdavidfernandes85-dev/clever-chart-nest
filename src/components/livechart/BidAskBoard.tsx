import { Loader2 } from "lucide-react";
import { useMultiSymbolTicksWithMeta } from "@/hooks/useMultiSymbolTicks";

interface Props {
  symbols: string[];
  onSelect?: (label: string) => void;
  activeSymbol?: string;
}

/**
 * Institutional price ladder.
 * Always mounted. Keeps last-good rows during refresh; never blanks on poll failure.
 * Rows without any tick data are filtered out (no empty dash rows).
 */

const COLS = "grid-cols-[minmax(0,1fr)_64px_64px_64px_52px]";
// "Data delayed" thresholds — chosen to absorb intermittent transport errors
// (rate limits, brief 5xx) without flickering. We require BOTH a sustained
// failure pattern AND/OR a clear stale window.
const STALE_MS = 25_000;            // no successful refresh for 25s
const MIN_CONSECUTIVE_ERRORS = 2;   // two failed cycles in a row

const BidAskBoard = ({ symbols, onSelect, activeSymbol }: Props) => {
  const { rows, lastUpdatedAt, consecutiveErrors, refreshing } =
    useMultiSymbolTicksWithMeta(symbols);
  const anyLoaded = Object.keys(rows).length > 0;
  const now = Date.now();
  // Delayed only after CONFIRMED failures (≥2 in a row) or genuine staleness.
  // A single transient error never trips the badge.
  const isDelayed =
    anyLoaded &&
    (consecutiveErrors >= MIN_CONSECUTIVE_ERRORS ||
      (lastUpdatedAt != null && now - lastUpdatedAt > STALE_MS));

  // Only render symbols that have valid tick data (live or last-good).
  const visible = symbols.filter((sym) => {
    const r = rows[sym.toUpperCase()] || rows[sym];
    return r && (r.bid != null || r.ask != null || r.last != null);
  });

  const statusLabel = !anyLoaded
    ? null
    : isDelayed
      ? { text: "Data delayed", dot: "bg-amber-500", color: "text-amber-400" }
      : { text: "Live", dot: "bg-emerald-500", color: "text-emerald-400" };

  return (
    <div className="flex h-full flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
          Bid / Ask Board
        </h3>
        {statusLabel ? (
          <span className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest ${statusLabel.color}`}>
            <span className={`inline-flex h-1.5 w-1.5 rounded-full ${statusLabel.dot}`} />
            {statusLabel.text}
          </span>
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
        )}
      </div>
      <div className={`grid ${COLS} items-center gap-1 border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500 shrink-0`}>
        <span>Symbol</span>
        <span className="text-right text-red-400/70">Bid</span>
        <span className="text-right">Last</span>
        <span className="text-right text-emerald-400/70">Ask</span>
        <span className="text-right">Sprd</span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {symbols.length === 0 ? (
          <li className="px-3 py-4 text-center text-[10px] font-mono text-neutral-500">
            No MT5 symbols loaded.
          </li>
        ) : visible.length === 0 ? (
          <li className="px-3 py-4 text-center text-[10px] font-mono text-neutral-500">
            {refreshing ? "Loading market data…" : "Waiting for tick data…"}
          </li>
        ) : visible.map((sym) => {
          const r = rows[sym.toUpperCase()] || rows[sym]!;
          const digits = r.digits ?? 5;
          const isActive = activeSymbol?.toUpperCase() === sym.toUpperCase();
          const fmt = (v: number | null | undefined) =>
            v == null
              ? "—"
              : v.toLocaleString("en-US", {
                  minimumFractionDigits: digits,
                  maximumFractionDigits: digits,
                });
          const spread = r.spread;
          const point = Math.pow(10, -digits);
          const spreadPts = spread != null ? spread / point : null;
          return (
            <li key={sym}>
              <button
                type="button"
                onClick={() => onSelect?.(sym)}
                className={`w-full grid ${COLS} items-center gap-1 px-2 py-[3px] text-left border-b border-neutral-900/80 transition-colors ${
                  isActive
                    ? "bg-[#FFCD05]/12 border-l-2 border-l-[#FFCD05] pl-[6px]"
                    : "hover:bg-neutral-900/40 border-l-2 border-l-transparent"
                }`}
              >
                <span className={`font-mono text-[10.5px] font-semibold truncate ${isActive ? "text-[#FFCD05]" : "text-neutral-100"}`}>
                  {sym}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-red-400">
                  {fmt(r.bid)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {fmt(r.last)}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-emerald-400">
                  {fmt(r.ask)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {spread == null ? "—" : spreadPts != null ? spreadPts.toFixed(1) : spread.toFixed(Math.min(digits, 5))}
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
