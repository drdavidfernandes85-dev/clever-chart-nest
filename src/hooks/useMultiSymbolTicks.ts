import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MultiTick {
  bid: number | null;
  ask: number | null;
  last: number | null;
  digits: number;
  changePct: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
}

/**
 * Polls `get-mt5-terminal-data` sequentially for each symbol every cycle.
 * Sequential + 350ms gap stays under the broker 120 req/min limit.
 * Returns the most-recent tick per symbol. 24h change/high/low are derived
 * from the daily session bar when available.
 */
export function useMultiSymbolTicks(symbols: string[], periodMs = 2500) {
  const [rows, setRows] = useState<Record<string, MultiTick>>({});
  const sessionOpen = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!symbols.length) return;
    let cancelled = false;

    const loadOne = async (sym: string) => {
      try {
        const { data } = await supabase.functions.invoke("get-mt5-terminal-data", {
          body: { selectedSymbol: sym },
        });
        if (cancelled || !data?.success) return;
        const tick = data.tick;
        const info = data.selectedSymbolInfo;
        if (!tick) return;
        const bid = tick.bid != null ? Number(tick.bid) : null;
        const ask = tick.ask != null ? Number(tick.ask) : null;
        const last =
          tick.last != null
            ? Number(tick.last)
            : bid != null && ask != null
              ? (bid + ask) / 2
              : null;
        const digits = Number(info?.digits) || 5;
        const high = tick.high != null ? Number(tick.high) : null;
        const low = tick.low != null ? Number(tick.low) : null;
        const open = tick.open != null ? Number(tick.open) : sessionOpen.current[sym] ?? null;
        if (open == null && last != null) sessionOpen.current[sym] = last;
        const changePct =
          open != null && last != null && open !== 0 ? ((last - open) / open) * 100 : null;
        setRows((r) => ({
          ...r,
          [sym]: { bid, ask, last, digits, changePct, high, low, open },
        }));
      } catch {
        /* ignore */
      }
    };

    const loadAll = async () => {
      for (const sym of symbols) {
        if (cancelled) return;
        await loadOne(sym);
        await new Promise((r) => setTimeout(r, 350));
      }
    };

    loadAll();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") loadAll();
    }, periodMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) loadAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [symbols.join(","), periodMs]);

  return rows;
}
