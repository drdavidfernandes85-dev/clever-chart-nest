import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAutoRefreshAllowed, checkAndHandle429 } from "@/lib/tradingLayerControl";

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
  /** Count of consecutive failed/empty refreshes. Resets to 0 on success. */
  consecutiveErrors: number;
  refreshing: boolean;
}

/**
 * Batched market-watch tick poller.
 * Calls `get-mt5-market-watch` once per cycle (default 5s) with the
 * requested symbol set and returns a `{ [SYMBOL_UPPER]: tick }` map.
 *
 * Pauses while the tab is hidden and resumes immediately on visibility.
 */
export function useMultiSymbolTicksWithMeta(symbols: string[], periodMs = 5000): MultiTickMeta {
  const [rows, setRows] = useState<Record<string, MultiTick>>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const sessionOpen = useRef<Record<string, number>>({});

  const key = symbols.map((s) => s.toUpperCase()).sort().join(",");

  useEffect(() => {
    if (!symbols.length) {
      // Keep previous rows on screen — symbol list may be temporarily empty
      // during a refresh cycle. Just stop polling until it returns.
      return;
    }
    let cancelled = false;

    const loadBatch = async () => {
      setRefreshing(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-mt5-market-watch", {
          body: { symbols, debug: false },
        });
        if (cancelled) return;
        if (error || !data?.success) {
          checkAndHandle429(data, error);
          setLastError(error?.message || data?.error || "Refresh failed");
          setConsecutiveErrors((n) => n + 1);
          return;
        }
        checkAndHandle429(data, null);
        const instruments: any[] = Array.isArray(data.instruments) ? data.instruments : [];
        if (instruments.length === 0) {
          setLastError("Empty payload");
          setConsecutiveErrors((n) => n + 1);
          return;
        }
        setRows((prev) => {
          const next = { ...prev };
          for (const inst of instruments) {
            const sym = String(inst.symbol || "").toUpperCase();
            if (!sym) continue;
            const bid = inst.bid != null ? Number(inst.bid) : null;
            const ask = inst.ask != null ? Number(inst.ask) : null;
            const last = inst.last != null
              ? Number(inst.last)
              : bid != null && ask != null ? (bid + ask) / 2 : null;
            const spread = inst.spread != null
              ? Number(inst.spread)
              : bid != null && ask != null ? Math.max(0, ask - bid) : null;
            const digits = Number(inst.digits) || 5;
            if (sessionOpen.current[sym] == null && last != null) {
              sessionOpen.current[sym] = last;
            }
            const open = sessionOpen.current[sym] ?? null;
            const changePct =
              open != null && last != null && open !== 0
                ? ((last - open) / open) * 100
                : null;
            next[sym] = { bid, ask, last, spread, digits, changePct, high: null, low: null, open };
          }
          return next;
        });
        setLastUpdatedAt(Date.now());
        setLastError(null);
        setConsecutiveErrors(0);
      } catch (e: any) {
        if (!cancelled) {
          setLastError(e?.message || "Network error");
          setConsecutiveErrors((n) => n + 1);
        }
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };

    if (isAutoRefreshAllowed()) loadBatch();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && isAutoRefreshAllowed()) loadBatch();
    }, periodMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled && isAutoRefreshAllowed()) loadBatch();
    };
    const onRefresh = () => { if (!cancelled) loadBatch(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("mt:refresh-market-watch", onRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("mt:refresh-market-watch", onRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, periodMs]);

  return { rows, lastUpdatedAt, lastError, consecutiveErrors, refreshing };
}

/** Backwards-compatible: returns just the rows map. */
export function useMultiSymbolTicks(symbols: string[], periodMs = 5000): Record<string, MultiTick> {
  return useMultiSymbolTicksWithMeta(symbols, periodMs).rows;
}
