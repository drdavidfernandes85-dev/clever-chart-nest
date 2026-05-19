import { useEffect, useMemo, useRef, useState } from "react";
import { MarketDataService } from "@/services/MarketDataService";
import { useQuote } from "@/hooks/useLiveMarketData";

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
 * Reads the currently selected symbol's quote from the centralized
 * liveMarketDataStore. No longer polls Trading Layer directly — registers
 * the selected symbol with MarketDataService (the only writer).
 *
 * Note: symbol info (contractSize / tickValue / volume bounds) is NOT in
 * the store yet. BrokerSymbolsContext still owns that one-shot info fetch
 * on symbol change; this hook only exposes live bid/ask/last/spread/digits.
 * Consumers that need contractSize etc. should keep reading from
 * BrokerSymbolsContext.selectedSymbolInfo.
 */
export function useSelectedQuote(
  selectedSymbol: string | null | undefined,
  _intervalMs = 3000,
): UseSelectedQuoteResult {
  const sym = (selectedSymbol || "").trim();
  const [lastGood, setLastGood] = useState<SelectedQuote | null>(null);
  const lastGoodRef = useRef<SelectedQuote | null>(null);

  // Register selected symbol with central service.
  useEffect(() => {
    MarketDataService.setSelectedSymbol(sym);
  }, [sym]);

  const q = useQuote(sym);

  const selectedQuote = useMemo<SelectedQuote | null>(() => {
    if (!sym) return null;
    if (!q) return lastGoodRef.current;
    const merged: SelectedQuote = {
      ...(lastGoodRef.current ?? ({} as SelectedQuote)),
      symbol: sym,
      bid: q.bid,
      ask: q.ask,
      last: q.last,
      spread: q.spread,
      digits: q.digits,
      contractSize: lastGoodRef.current?.contractSize ?? null,
      tickValue: lastGoodRef.current?.tickValue ?? null,
      tickSize: lastGoodRef.current?.tickSize ?? null,
      volumeMin: lastGoodRef.current?.volumeMin ?? null,
      volumeMax: lastGoodRef.current?.volumeMax ?? null,
      volumeStep: lastGoodRef.current?.volumeStep ?? null,
      valid: true,
    };
    lastGoodRef.current = merged;
    return merged;
  }, [q, sym]);

  useEffect(() => {
    if (selectedQuote) setLastGood(selectedQuote);
  }, [selectedQuote]);

  const dataDelayed = !q;

  const refresh = () => MarketDataService.refreshSelected();

  return { selectedQuote, lastGoodSelectedSymbolData: lastGood, dataDelayed, refresh };
}
