import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuotes, useRateLimit, useMarketStatus } from "@/hooks/useLiveMarketData";
import { MarketDataService } from "@/services/MarketDataService";

interface Props {
  symbols: string[];
  onSelect?: (label: string) => void;
  activeSymbol?: string;
}

const COLS = "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_56px]";

/**
 * BidAskBoard — display only.
 *
 * Reads quotes from the centralized `liveMarketDataStore` via
 * `useQuotes`. Subscribes its symbol list to the shared watchlist on
 * `MarketDataService` so prices come from the single polling loop.
 * Never performs its own Trading Layer poll.
 */
const BidAskBoard = ({ symbols, onSelect, activeSymbol }: Props) => {
  const { t } = useLanguage();
  const selectedSymbol = activeSymbol || "";

  // Push the visible symbol set into the shared watchlist so the
  // central service polls them on the 10s watchlist cadence.
  useEffect(() => {
    const cleaned = symbols.filter(Boolean);
    MarketDataService.subscribeWatchlist("bid-ask-board", cleaned);
    return () => MarketDataService.subscribeWatchlist("bid-ask-board", []);
  }, [symbols.join(",")]);

  const liveQuotes = useQuotes(symbols);
  const rl = useRateLimit();
  const status = useMarketStatus();

  // Keep a last-good cache so a transient empty store doesn't blank the board.
  type Quote = {
    symbol: string;
    bid: number | null;
    ask: number | null;
    last: number | null;
    spread: number | null;
    digits: number | null;
  };
  const lastGoodRef = useRef<Record<string, Quote>>({});
  const [, force] = useState(0);

  const quotesArray = useMemo<Quote[]>(() => {
    const out: Quote[] = [];
    for (const sym of symbols) {
      const key = sym.toUpperCase();
      const live = liveQuotes[key];
      if (live && (live.bid != null || live.ask != null)) {
        const q: Quote = {
          symbol: sym,
          bid: live.bid,
          ask: live.ask,
          last: live.last,
          spread: live.spread,
          digits: live.digits,
        };
        lastGoodRef.current[key] = q;
        out.push(q);
      } else if (lastGoodRef.current[key]) {
        out.push(lastGoodRef.current[key]);
      }
    }
    return out;
  }, [symbols.join(","), liveQuotes]);

  // Re-render on rate-limit/status changes so badge updates.
  useEffect(() => {
    force((n) => n + 1);
  }, [rl.active, status]);

  const visible = quotesArray;
  const hasFetched = visible.length > 0;
  const isDelayed = status === "stale" || (rl.active && visible.length > 0);
  const isRateLimited = rl.active;
  const statusLabel = !hasFetched
    ? null
    : isRateLimited
      ? { text: "Rate limited", dot: "bg-amber-500", color: "text-amber-400" }
      : isDelayed
        ? { text: "Data delayed", dot: "bg-amber-500", color: "text-amber-400" }
        : { text: "Live", dot: "bg-emerald-500", color: "text-emerald-400" };

  return (
    <div className="flex h-full flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-[#FFCD05]" />
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
            {t("terminal.bidAskBoard" as never)}
          </h3>
        </div>
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
        <span>{t("terminal.symbol" as never)}</span>
        <span className="text-right text-red-400/70">{t("terminal.bid" as never)}</span>
        <span className="text-right">{t("terminal.last" as never)}</span>
        <span className="text-right text-emerald-400/70">Ask</span>
        <span className="text-right">Sprd</span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <li className="px-3 py-4 text-center text-[10px] font-mono text-neutral-500">
            Waiting for tick data…
          </li>
        ) : visible.map((q) => {
          const digits = q.digits ?? 5;
          const symUpper = q.symbol.toUpperCase();
          const isActive = selectedSymbol.toUpperCase() === symUpper;
          const fmt = (v: number | null | undefined) =>
            v == null
              ? "—"
              : v.toLocaleString("en-US", {
                  minimumFractionDigits: digits,
                  maximumFractionDigits: digits,
                });
          const point = Math.pow(10, -digits);
          const spreadPts = q.spread != null ? q.spread / point : null;
          return (
            <li key={q.symbol}>
              <button
                type="button"
                onClick={() => onSelect?.(q.symbol)}
                className={`w-full grid ${COLS} items-center gap-1 px-2 py-[3px] text-left border-b border-neutral-900/80 transition-colors ${
                  isActive
                    ? "bg-[#FFCD05]/12 border-l-2 border-l-[#FFCD05] pl-[6px]"
                    : "hover:bg-neutral-900/40 border-l-2 border-l-transparent"
                }`}
              >
                <span className={`font-mono text-[10.5px] font-semibold truncate ${isActive ? "text-[#FFCD05]" : "text-neutral-100"}`}>
                  {q.symbol}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-red-400">
                  {fmt(q.bid)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {fmt(q.last)}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-emerald-400">
                  {fmt(q.ask)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {q.spread == null ? "—" : spreadPts != null ? spreadPts.toFixed(1) : q.spread.toFixed(Math.min(digits, 5))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="shrink-0 border-t border-neutral-900 bg-[#070707] px-2 py-[3px] text-[8px] font-mono uppercase tracking-[0.22em] text-[#5d6168] text-center">
        Powered by Trading Layer
      </div>
    </div>
  );
};

export default BidAskBoard;
