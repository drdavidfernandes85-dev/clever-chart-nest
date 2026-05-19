import { useEffect, useMemo, useState } from "react";
import { useQuote, useMarketStatus } from "@/hooks/useLiveMarketData";
import { MarketDataService } from "@/services/MarketDataService";

interface Props {
  symbol: string;
  displayLabel?: string;
}

/**
 * Compact, single-row symbol/bid/ask/spread/tick-time header for the
 * right rail. Replaces the heavy quote panel and gives the order ticket
 * primary visual weight directly below it.
 */
const CompactQuoteHeader = ({ symbol, displayLabel }: Props) => {
  const sym = (symbol || "").trim();

  // Make sure the centralized service polls this symbol on the fast cadence.
  useEffect(() => {
    if (!sym) return;
    MarketDataService.setSelectedSymbol(sym);
  }, [sym]);

  const quote = useQuote(sym);
  const status = useMarketStatus();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const tickAge = useMemo(() => {
    if (!quote?.timestamp) return null;
    const sec = Math.max(0, Math.floor((now - quote.timestamp) / 1000));
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
  }, [now, quote?.timestamp]);

  const digits = quote?.digits ?? 5;
  const fmt = (v: number | null | undefined) =>
    v == null
      ? "—"
      : v.toLocaleString("en-US", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });

  const point = Math.pow(10, -digits);
  const spreadPts =
    quote?.spread != null ? (quote.spread / point).toFixed(1) : null;

  const stale = status === "stale";

  return (
    <div className="rounded-lg bg-[#0A0B0D]/80 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-heading text-[13px] font-bold tracking-tight text-[#E8E8EA] truncate">
            {displayLabel || sym}
          </span>
          <span
            className={`inline-flex h-1.5 w-1.5 rounded-full ${
              stale
                ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
            }`}
          />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#5d6168] tabular-nums">
          {tickAge ? `${tickAge} ago` : "—"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <span className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-[#5d6168]">
            Bid
          </span>
          <span className="font-mono text-[13px] font-bold tabular-nums text-red-400">
            {fmt(quote?.bid ?? null)}
          </span>
        </div>
        <div className="flex flex-col items-center border-x border-[#1a1c1f]">
          <span className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-[#5d6168]">
            Spread
          </span>
          <span className="font-mono text-[12px] font-semibold tabular-nums text-[#C9CDD2]">
            {spreadPts ?? "—"}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-[#5d6168]">
            Ask
          </span>
          <span className="font-mono text-[13px] font-bold tabular-nums text-emerald-400">
            {fmt(quote?.ask ?? null)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CompactQuoteHeader;
