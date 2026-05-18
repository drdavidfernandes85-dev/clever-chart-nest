import { Loader2 } from "lucide-react";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";

interface Props {
  symbols: string[];
  onSelect?: (label: string) => void;
  activeSymbol?: string;
}

const BidAskBoard = ({ symbols, onSelect, activeSymbol }: Props) => {
  const rows = useMultiSymbolTicks(symbols);
  const anyLoaded = Object.keys(rows).length > 0;

  return (
    <div className="flex h-full flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
          Bid / Ask Board
        </h3>
        {anyLoaded ? (
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-[#FFCD05]" />
        )}
      </div>
      <div className="grid grid-cols-[1fr_60px_60px_60px_48px] items-center gap-1 border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500 shrink-0">
        <span>Symbol</span>
        <span className="text-right text-red-400/80">Bid</span>
        <span className="text-right">Last</span>
        <span className="text-right text-emerald-400/80">Ask</span>
        <span className="text-right">Spread</span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {symbols.length === 0 ? (
          <li className="px-3 py-4 text-center text-[10px] font-mono text-neutral-500">
            No MT5 symbols loaded.
          </li>
        ) : symbols.map((sym) => {
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
          const spread = r?.spread;
          return (
            <li key={sym}>
              <button
                type="button"
                onClick={() => onSelect?.(sym)}
                className={`w-full grid grid-cols-[1fr_60px_60px_60px_48px] items-center gap-1 px-2 py-[3px] text-left border-b border-neutral-900/80 transition-colors ${
                  isActive
                    ? "bg-[#FFCD05]/12 border-l-2 border-l-[#FFCD05]"
                    : "hover:bg-neutral-900/40"
                }`}
              >
                <span className={`font-mono text-[10.5px] font-semibold ${isActive ? "text-[#FFCD05]" : "text-neutral-100"}`}>
                  {sym}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-red-400">
                  {fmt(r?.bid)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {fmt(r?.last)}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-emerald-400">
                  {fmt(r?.ask)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {spread == null ? "—" : spread.toFixed(Math.min(digits, 5))}
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
