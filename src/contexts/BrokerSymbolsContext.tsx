import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveAccount } from "@/contexts/LiveAccountContext";

export interface BrokerSymbol {
  symbol: string;
  description?: string | null;
  digits?: number | null;
  contractSize?: number | null;
  assetClass?: string | null;
}

/** Used until the broker symbol list loads. Clearly marked as fallback. */
export const FALLBACK_SYMBOLS: BrokerSymbol[] = [
  { symbol: "XAUUSD", description: "Gold vs USD (fallback)" },
  { symbol: "EURUSD", description: "Euro vs USD (fallback)" },
  { symbol: "GBPUSD", description: "Pound vs USD (fallback)" },
  { symbol: "US30",   description: "Dow Jones 30 (fallback)" },
  { symbol: "NAS100", description: "Nasdaq 100 (fallback)" },
];

interface Ctx {
  symbols: BrokerSymbol[];
  /** True only when symbols came from the broker (not fallback). */
  isLive: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const BrokerCtx = createContext<Ctx | null>(null);

export function BrokerSymbolsProvider({ children }: { children: ReactNode }) {
  const { connected } = useLiveAccount();
  const [symbols, setSymbols] = useState<BrokerSymbol[]>(FALLBACK_SYMBOLS);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!connected) {
      setSymbols(FALLBACK_SYMBOLS);
      setIsLive(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error: invErr } = await supabase.functions.invoke(
        "get-trading-symbols",
        { body: { limit: 100 } },
      );
      if (invErr) throw invErr;
      if (data?.success && Array.isArray(data.symbols) && data.symbols.length > 0) {
        setSymbols(data.symbols as BrokerSymbol[]);
        setIsLive(true);
        setError(null);
      } else {
        setSymbols(FALLBACK_SYMBOLS);
        setIsLive(false);
        setError(data?.error ?? "Broker symbols unavailable. Please refresh.");
      }
    } catch (e: any) {
      setSymbols(FALLBACK_SYMBOLS);
      setIsLive(false);
      setError(e?.message ?? "Broker symbols unavailable. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({ symbols, isLive, loading, error, refresh }),
    [symbols, isLive, loading, error, refresh],
  );

  return <BrokerCtx.Provider value={value}>{children}</BrokerCtx.Provider>;
}

export function useBrokerSymbols(): Ctx {
  const ctx = useContext(BrokerCtx);
  if (!ctx) {
    return { symbols: FALLBACK_SYMBOLS, isLive: false, loading: false, error: null, refresh: async () => {} };
  }
  return ctx;
}
