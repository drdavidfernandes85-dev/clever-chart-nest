import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAutoRefreshAllowed, checkAndHandle429 } from "@/lib/tradingLayerControl";

export interface SelectedQuote {
  symbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  spread: number | null;
  digits: number | null;
  point?: number | null;
  description?: string | null;
  contractSize: number | null;
  tickValue: number | null;
  tickSize: number | null;
  volumeMin: number | null;
  volumeMax: number | null;
  volumeStep: number | null;
  currencyBase?: string | null;
  currencyProfit?: string | null;
  currencyMargin?: string | null;
  valid?: boolean;
}

interface UseSelectedQuoteResult {
  selectedQuote: SelectedQuote | null;
  lastGoodSelectedSymbolData: SelectedQuote | null;
  dataDelayed: boolean;
  refresh: () => void;
}

/**
 * Polls get-mt5-quotes for the currently selected symbol and exposes
 * a stale-while-revalidate snapshot. Order Ticket / chart consumers should
 * prefer `selectedQuote ?? lastGoodSelectedSymbolData` so the UI is never
 * cleared on a transient refresh failure.
 */
export function useSelectedQuote(
  selectedSymbol: string | null | undefined,
  intervalMs = 3000,
): UseSelectedQuoteResult {
  const [selectedQuote, setSelectedQuote] = useState<SelectedQuote | null>(null);
  const [lastGood, setLastGood] = useState<SelectedQuote | null>(null);
  const [dataDelayed, setDataDelayed] = useState(false);
  const lastGoodRef = useRef<SelectedQuote | null>(null);
  const tickRef = useRef(0);

  const sym = (selectedSymbol || "").trim();

  useEffect(() => {
    if (!sym) return;
    let cancelled = false;
    const load = async () => {
      tickRef.current += 1;
      try {
        const { data, error } = await supabase.functions.invoke("get-mt5-quotes", {
          body: { selectedSymbol: sym, debug: false },
        });
        if (cancelled) return;
        const sq: SelectedQuote | null = data?.selectedQuote ?? null;
        const usable =
          !error &&
          data?.success === true &&
          sq &&
          (sq.bid != null || sq.ask != null || sq.last != null || sq.volumeMin != null);
        if (!usable) {
          checkAndHandle429(data, error);
          setDataDelayed(true);
          return;
        }
        // Merge field-by-field so a missing field on this tick keeps the last good value.
        const prev = lastGoodRef.current;
        const merged: SelectedQuote = {
          ...(prev ?? ({} as SelectedQuote)),
          ...sq,
          symbol: sq!.symbol || prev?.symbol || sym,
          bid: sq!.bid != null ? sq!.bid : prev?.bid ?? null,
          ask: sq!.ask != null ? sq!.ask : prev?.ask ?? null,
          last: sq!.last != null ? sq!.last : prev?.last ?? null,
          spread: sq!.spread != null ? sq!.spread : prev?.spread ?? null,
          digits: sq!.digits != null ? sq!.digits : prev?.digits ?? null,
          contractSize: sq!.contractSize ?? prev?.contractSize ?? null,
          tickValue: sq!.tickValue ?? prev?.tickValue ?? null,
          tickSize: sq!.tickSize ?? prev?.tickSize ?? null,
          volumeMin: sq!.volumeMin ?? prev?.volumeMin ?? null,
          volumeMax: sq!.volumeMax ?? prev?.volumeMax ?? null,
          volumeStep: sq!.volumeStep ?? prev?.volumeStep ?? null,
          valid: true,
        };
        lastGoodRef.current = merged;
        setLastGood(merged);
        setSelectedQuote(merged);
        setDataDelayed(false);
      } catch {
        if (!cancelled) setDataDelayed(true);
      }
    };
    if (isAutoRefreshAllowed()) load();
    const id = window.setInterval(() => {
      if (isAutoRefreshAllowed()) load();
    }, intervalMs);
    const onRefresh = () => { if (!cancelled) load(); };
    window.addEventListener("mt:refresh-quotes", onRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("mt:refresh-quotes", onRefresh);
    };
  }, [sym, intervalMs]);

  // When user picks a new symbol, drop the live snapshot but keep lastGood
  // so the ticket doesn't blank during the first refresh.
  useEffect(() => {
    setSelectedQuote(null);
  }, [sym]);

  const refresh = () => {
    // Bump tickRef to indicate a manual refresh request; the polling loop will
    // pick up on the next interval. Consumers can call this from a button.
    tickRef.current += 1;
  };

  return { selectedQuote, lastGoodSelectedSymbolData: lastGood, dataDelayed, refresh };
}
