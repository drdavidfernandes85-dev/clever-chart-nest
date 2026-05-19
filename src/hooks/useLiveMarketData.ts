/**
 * React hooks for liveMarketDataStore.
 * All UI widgets must read from these (or subscribe directly) — never
 * call Trading Layer endpoints themselves.
 */

import { useRef, useSyncExternalStore } from "react";
import {
  liveMarketDataStore,
  type LiveMarketDataState,
  type LiveQuote,
  type LiveAccountSnapshot,
  type LivePositionRow,
  type MarketStatus,
  type RateLimitInfo,
  type MarketDataDiagnostics,
} from "@/lib/liveMarketDataStore";

const subscribe = (cb: () => void) => liveMarketDataStore.subscribe(cb);
const getSnapshot = (): LiveMarketDataState => liveMarketDataStore.getState();

export function useLiveMarketData(): LiveMarketDataState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useQuote(symbol: string | null | undefined): LiveQuote | null {
  const sym = (symbol || "").toUpperCase();
  return useSyncExternalStore(
    subscribe,
    () => (sym ? liveMarketDataStore.getState().quotes[sym] ?? null : null),
    () => (sym ? liveMarketDataStore.getState().quotes[sym] ?? null : null),
  );
}

export function useQuotes(symbols: string[]): Record<string, LiveQuote> {
  const key = symbols.map((s) => s.toUpperCase()).sort().join(",");
  const cacheRef = useRef<{ key: string; quotesRef: Record<string, LiveQuote> | null; result: Record<string, LiveQuote> }>({
    key: "",
    quotesRef: null,
    result: {},
  });
  const getSnap = () => {
    const all = liveMarketDataStore.getState().quotes;
    const cache = cacheRef.current;
    if (cache.key === key && cache.quotesRef === all) return cache.result;
    const out: Record<string, LiveQuote> = {};
    for (const s of key.split(",")) {
      if (s && all[s]) out[s] = all[s];
    }
    // Only return new object if contents differ from cached
    if (cache.key === key) {
      const prev = cache.result;
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(out);
      if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === out[k])) {
        cacheRef.current = { key, quotesRef: all, result: prev };
        return prev;
      }
    }
    cacheRef.current = { key, quotesRef: all, result: out };
    return out;
  };
  return useSyncExternalStore(subscribe, getSnap, getSnap);
}

export function useLiveAccountSnapshot(): LiveAccountSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    () => liveMarketDataStore.getState().account,
    () => liveMarketDataStore.getState().account,
  );
}

export function useLivePositions(): LivePositionRow[] {
  return useSyncExternalStore(
    subscribe,
    () => liveMarketDataStore.getState().positions,
    () => liveMarketDataStore.getState().positions,
  );
}

export function useMarketStatus(): MarketStatus {
  return useSyncExternalStore(
    subscribe,
    () => liveMarketDataStore.getState().status,
    () => liveMarketDataStore.getState().status,
  );
}

export function useRateLimit(): RateLimitInfo {
  return useSyncExternalStore(
    subscribe,
    () => liveMarketDataStore.getState().rateLimit,
    () => liveMarketDataStore.getState().rateLimit,
  );
}

export function useMarketDataDiagnostics(): MarketDataDiagnostics {
  return useSyncExternalStore(
    subscribe,
    () => liveMarketDataStore.getState().diagnostics,
    () => liveMarketDataStore.getState().diagnostics,
  );
}
