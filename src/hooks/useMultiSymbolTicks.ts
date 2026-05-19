import { useEffect, useMemo, useRef } from "react";
import { liveMarketDataStore } from "@/lib/liveMarketDataStore";
import { MarketDataService } from "@/services/MarketDataService";
import { useQuotes } from "@/hooks/useLiveMarketData";

export interface MultiTick {
  bid: number | null;
  ask: number | null;
  last: number | null;
  spread: number | null;
  digits: number;
  changePct: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
}

export interface MultiTickMeta {
  rows: Record<string, MultiTick>;
  lastUpdatedAt: number | null;
  lastError: string | null;
  consecutiveErrors: number;
  refreshing: boolean;
}

/**
 * Reads watchlist ticks from the centralized liveMarketDataStore. No longer
 * polls Trading Layer directly — registers the symbol list with
 * MarketDataService which is the only writer.
 */
export function useMultiSymbolTicksWithMeta(symbols: string[], _periodMs = 5000): MultiTickMeta {
  const key = symbols.map((s) => s.toUpperCase()).sort().join(",");
  const sessionOpen = useRef<Record<string, number>>({});

  // Register symbol list with the central service.
  useEffect(() => {
    MarketDataService.setWatchlist(key ? key.split(",") : []);
    return () => {
      // Don't clear globally — other consumers may rely on it.
    };
  }, [key]);

  const quotes = useQuotes(key ? key.split(",") : []);

  const rows = useMemo(() => {
    const out: Record<string, MultiTick> = {};
    for (const sym of Object.keys(quotes)) {
      const q = quotes[sym];
      if (!q) continue;
      const last = q.last ?? (q.bid != null && q.ask != null ? (q.bid + q.ask) / 2 : null);
      if (sessionOpen.current[sym] == null && last != null) sessionOpen.current[sym] = last;
      const open = sessionOpen.current[sym] ?? null;
      const changePct =
        open != null && last != null && open !== 0 ? ((last - open) / open) * 100 : null;
      out[sym] = {
        bid: q.bid,
        ask: q.ask,
        last,
        spread: q.spread,
        digits: q.digits ?? 5,
        changePct,
        high: null,
        low: null,
        open,
      };
    }
    return out;
  }, [quotes]);

  const state = liveMarketDataStore.getState();
  return {
    rows,
    lastUpdatedAt: state.diagnostics.lastTickAt,
    lastError: state.lastError,
    consecutiveErrors: 0,
    refreshing: false,
  };
}

/** Backwards-compatible: returns just the rows map. */
export function useMultiSymbolTicks(symbols: string[], periodMs = 5000): Record<string, MultiTick> {
  return useMultiSymbolTicksWithMeta(symbols, periodMs).rows;
}
