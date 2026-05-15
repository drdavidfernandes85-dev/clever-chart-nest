import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveAccount } from "@/contexts/LiveAccountContext";

export interface BrokerSymbol {
  symbol: string;
  brokerSymbol: string;
  name: string;
  displayName: string;
  description?: string | null;
  digits?: number | null;
  contractSize?: number | null;
  assetClass?: string | null;
}

const enrich = (s: any): BrokerSymbol => {
  const sym = String(s?.symbol ?? s?.brokerSymbol ?? s?.name ?? "").toUpperCase();
  return {
    symbol: sym,
    brokerSymbol: sym,
    name: sym,
    displayName: s?.displayName ?? sym,
    description: s?.description ?? null,
    digits: s?.digits ?? null,
    contractSize: s?.contractSize ?? null,
    assetClass: s?.assetClass ?? null,
  };
};

export const FALLBACK_SYMBOLS: BrokerSymbol[] = [
  { symbol: "XAUUSD", description: "Gold vs USD (fallback)" },
  { symbol: "EURUSD", description: "Euro vs USD (fallback)" },
  { symbol: "GBPUSD", description: "Pound vs USD (fallback)" },
  { symbol: "GBPCAD", description: "Pound vs CAD (fallback)" },
  { symbol: "US30",   description: "Dow Jones 30 (fallback)" },
  { symbol: "NAS100", description: "Nasdaq 100 (fallback)" },
].map(enrich);

interface Ctx {
  symbols: BrokerSymbol[];
  isLive: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  selectedSymbolValid: boolean;
  selectedSymbolInfo: any;
  tick: any;
  /** Last raw response from get-mt5-symbol-data (debug). */
  lastResponse: unknown;
  refresh: (selectedSymbol?: string) => Promise<void>;
  setSelectedBrokerSymbol: (symbol: string) => void;
}

const BrokerCtx = createContext<Ctx | null>(null);

const normalize = (v: string) =>
  String(v || "").replace("/", "").replace("-", "").replace(" ", "").toUpperCase();

export function BrokerSymbolsProvider({ children }: { children: ReactNode }) {
  const { connected } = useLiveAccount();
  const [symbols, setSymbols] = useState<BrokerSymbol[]>(FALLBACK_SYMBOLS);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [selectedSymbolValid, setSelectedSymbolValid] = useState(false);
  const [selectedSymbolInfo, setSelectedSymbolInfo] = useState<any>(null);
  const [tick, setTick] = useState<any>(null);
  const [selectedBrokerSymbol, setSelectedBrokerSymbol] = useState<string>("EURUSD");

  const refresh = useCallback(
    async (overrideSelected?: string) => {
      if (!connected) {
        setSymbols(FALLBACK_SYMBOLS);
        setIsLive(false);
        setLoaded(false);
        setSelectedSymbolValid(false);
        setSelectedSymbolInfo(null);
        setTick(null);
        setError(null);
        return;
      }
      setLoading(true);
      const normalizedSelectedSymbol = normalize(overrideSelected || selectedBrokerSymbol || "EURUSD");
      try {
        const { data, error: invErr } = await supabase.functions.invoke(
          "get-mt5-symbol-data",
          { body: { debug: true, selectedSymbol: normalizedSelectedSymbol } },
        );

        if (invErr) {
          setLastResponse({ success: false, error: invErr.message ?? String(invErr) });
          setSymbols(FALLBACK_SYMBOLS);
          setIsLive(false);
          setLoaded(false);
          setSelectedSymbolValid(false);
          setSelectedSymbolInfo(null);
          setTick(null);
          setError(invErr.message ?? "Broker symbols could not be loaded. Please refresh.");
          return;
        }

        setLastResponse(data);

        if (data?.success === true) {
          const list = Array.isArray(data.symbols) ? data.symbols : [];
          const enriched = list.length > 0 ? list.map(enrich) : FALLBACK_SYMBOLS;
          setSymbols(enriched);
          setIsLive(list.length > 0);
          setLoaded(data.symbolsLoaded === true || list.length > 0);
          setSelectedSymbolValid(data.selectedSymbolValid === true);
          setSelectedSymbolInfo(data.selectedSymbolInfo || null);
          setTick(data.tick || null);
          setError(null);
        } else {
          const list = Array.isArray(data?.symbols) ? data.symbols : [];
          setSymbols(list.length > 0 ? list.map(enrich) : FALLBACK_SYMBOLS);
          setIsLive(false);
          setLoaded(data?.symbolsLoaded === true || list.length > 0);
          setSelectedSymbolValid(false);
          setSelectedSymbolInfo(null);
          setTick(null);
          setError(data?.error ?? "Broker symbols could not be loaded. Please refresh.");
        }
      } catch (e: any) {
        setLastResponse({ success: false, error: e?.message ?? String(e) });
        setSymbols(FALLBACK_SYMBOLS);
        setIsLive(false);
        setLoaded(false);
        setSelectedSymbolValid(false);
        setSelectedSymbolInfo(null);
        setTick(null);
        setError(e?.message ?? "Broker symbols could not be loaded. Please refresh.");
      } finally {
        setLoading(false);
      }
    },
    [connected, selectedBrokerSymbol],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      symbols,
      isLive,
      loading,
      loaded,
      error,
      selectedSymbolValid,
      selectedSymbolInfo,
      tick,
      lastResponse,
      refresh,
      setSelectedBrokerSymbol,
    }),
    [symbols, isLive, loading, loaded, error, selectedSymbolValid, selectedSymbolInfo, tick, lastResponse, refresh],
  );

  return <BrokerCtx.Provider value={value}>{children}</BrokerCtx.Provider>;
}

export function useBrokerSymbols(): Ctx {
  const ctx = useContext(BrokerCtx);
  if (!ctx) {
    return {
      symbols: FALLBACK_SYMBOLS,
      isLive: false,
      loading: false,
      loaded: false,
      error: null,
      selectedSymbolValid: false,
      selectedSymbolInfo: null,
      tick: null,
      lastResponse: null,
      refresh: async () => {},
      setSelectedBrokerSymbol: () => {},
    };
  }
  return ctx;
}
