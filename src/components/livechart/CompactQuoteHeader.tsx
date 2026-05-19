import { useEffect, useMemo, useState } from "react";
import { useQuote, useMarketStatus } from "@/hooks/useLiveMarketData";
import { MarketDataService } from "@/services/MarketDataService";

interface Props {
  symbol: string;
  displayLabel?: string;
  /** Compact mode shows a single dense row (for right rail). */
  variant?: "compact" | "prominent";
}

/**
 * Compact symbol / bid / ask / spread / tick-age block.
 * Two visual variants:
 *  - "compact"   : right-rail snapshot above the order ticket.
 *  - "prominent" : large Sell | Spread | Buy strip for the chart header.
 */
const CompactQuoteHeader = ({ symbol, displayLabel, variant = "compact" }: Props) => {
  const sym = (symbol || "").trim();

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

  if (variant === "prominent") {
    return (
      <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-[#0A0B0D]/70">
        <div className="flex flex-col min-w-0">
          <span className="font-heading text-[13px] font-bold tracking-tight text-[#E8E8EA] truncate">
            {displayLabel || sym}
          </span>
          <span className="flex items-center gap-1.5 text-[8.5px] font-mono uppercase tracking-[0.18em] text-[#5d6168]">
            <span
              className={`inline-flex h-1.5 w-1.5 rounded-full ${
                stale ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            {stale ? "Stale" : "Live"} · INFINOX MT5
            {tickAge && <span className="text-[#3f4348]">· {tickAge}</span>}
          </span>
        </div>

        <div className="ml-auto flex items-stretch gap-2">
          <div className="flex flex-col items-end px-3 py-1 rounded-md bg-red-500/[0.06]">
            <span className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-red-400/70">
              Sell
            </span>
            <span className="font-mono text-[18px] font-bold leading-none tabular-nums text-red-400">
              {fmt(quote?.bid ?? null)}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center px-2 rounded-md bg-[#0a0a0a]">
            <span className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-[#5d6168]">
              Sprd
            </span>
            <span className="font-mono text-[12px] font-semibold tabular-nums text-[#C9CDD2]">
              {spreadPts ?? "—"}
            </span>
          </div>
          <div className="flex flex-col items-start px-3 py-1 rounded-md bg-emerald-500/[0.06]">
            <span className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-emerald-400/70">
              Buy
            </span>
            <span className="font-mono text-[18px] font-bold leading-none tabular-nums text-emerald-400">
              {fmt(quote?.ask ?? null)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#0A0B0D]/80 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-heading text-[12px] font-bold tracking-tight text-[#E8E8EA] truncate">
            {displayLabel || sym}
          </span>
          <span
            className={`inline-flex items-center gap-1 h-4 px-1.5 rounded-sm border font-mono text-[8.5px] uppercase tracking-[0.16em] ${
              stale
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            <span
              className={`inline-flex h-1 w-1 rounded-full ${
                stale ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            {stale ? "Stale" : "Live"}
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#5d6168] tabular-nums shrink-0">
          {tickAge ? `${tickAge} ago` : "—"}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[8.5px] font-mono uppercase tracking-[0.18em] text-[#5d6168]">Bid</span>
          <span className="font-mono text-[12.5px] font-bold tabular-nums text-red-400 truncate">
            {fmt(quote?.bid ?? null)}
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-[#8E949C] shrink-0">
          {spreadPts ?? "—"}
        </span>
        <div className="flex items-baseline gap-1.5 min-w-0 justify-end">
          <span className="font-mono text-[12.5px] font-bold tabular-nums text-emerald-400 truncate">
            {fmt(quote?.ask ?? null)}
          </span>
          <span className="text-[8.5px] font-mono uppercase tracking-[0.18em] text-[#5d6168]">Ask</span>
        </div>
      </div>
    </div>
  );
};

export default CompactQuoteHeader;
