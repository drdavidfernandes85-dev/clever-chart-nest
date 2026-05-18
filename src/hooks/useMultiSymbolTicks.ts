import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Batched market-watch tick poller.
 * Calls `get-mt5-market-watch` once per cycle (default 5s) with the
 * requested symbol set and returns a `{ [SYMBOL_UPPER]: tick }` map.
 *
 * Pauses while the tab is hidden and resumes immediately on visibility.
 */
export function useMultiSymbolTicks(symbols: string[], periodMs = 5000) {
  const [rows, setRows] = useState<Record<string, MultiTick>>({});
  const sessionOpen = useRef<Record<string, number>>({});

  const key = symbols.map((s) => s.toUpperCase()).sort().join(",");

  useEffect(() => {
    if (!symbols.length) {
      setRows({});
      return;
    }
    let cancelled = false;

    const loadBatch = async () => {
      try {
        const { data } = await supabase.functions.invoke("get-mt5-market-watch", {
          body: { symbols, debug: false },
        });
        if (cancelled || !data?.success) return;
        const instruments: any[] = Array.isArray(data.instruments) ? data.instruments : [];
        if (instruments.length === 0) return;
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
            // Track session open to derive a 24h % change client-side.
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
      } catch {
        /* ignore */
      }
    };

    loadBatch();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") loadBatch();
    }, periodMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) loadBatch();
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

  return rows;
}
