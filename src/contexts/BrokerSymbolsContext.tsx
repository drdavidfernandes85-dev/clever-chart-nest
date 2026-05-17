import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const sym = String(s?.name ?? s?.brokerSymbol ?? s?.symbol ?? "").toUpperCase();
  return {
    symbol: sym,
    brokerSymbol: s?.brokerSymbol ?? s?.name ?? sym,
    name: s?.name ?? sym,
    displayName: s?.displayName ?? s?.name ?? sym,
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
  /** Last raw response from get-mt5-symbols (debug). */
  lastResponse: unknown;
  /** Last raw response from get-mt5-symbol-data (debug). */
  lastSymbolDataResponse: unknown;
  /** Pass `{ force: true }` to bypass localStorage cache and refetch. */
  refresh: (selectedSymbol?: string, opts?: { force?: boolean }) => Promise<void>;
  setSelectedBrokerSymbol: (symbol: string) => void;
}

const BrokerCtx = createContext<Ctx | null>(null);

const normalize = (v: string) =>
  String(v || "").replace("/", "").replace("-", "").replace(" ", "").toUpperCase();

const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h
const cacheKey = (uid: string) => `eltr.brokerSymbols.v2.${uid}`;

function readCache(uid: string): { symbols: BrokerSymbol[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.symbols) || typeof parsed?.ts !== "number") return null;
    return parsed;
  } catch { return null; }
}
function writeCache(uid: string, symbols: BrokerSymbol[]) {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({ symbols, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function BrokerSymbolsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [symbols, setSymbols] = useState<BrokerSymbol[]>(FALLBACK_SYMBOLS);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [lastSymbolDataResponse, setLastSymbolDataResponse] = useState<unknown>(null);
  const [selectedSymbolValid, setSelectedSymbolValid] = useState(false);
  const [selectedSymbolInfo, setSelectedSymbolInfo] = useState<any>(null);
  const [tick, setTick] = useState<any>(null);
  const [selectedBrokerSymbol, setSelectedBrokerSymbol] = useState<string>("EURUSD");

  // Fetch full broker symbols list via the new get-mt5-symbols function.
  const refresh = useCallback(
    async (_overrideSelected?: string, opts?: { force?: boolean }) => {
      if (!user) {
        setSymbols(FALLBACK_SYMBOLS);
        setIsLive(false);
        setLoaded(false);
        setError(null);
        return;
      }
      const force = opts?.force === true;
      // Hydrate from cache instantly when not forcing.
      if (!force) {
        const cached = readCache(user.id);
        if (cached && cached.symbols.length > 0) {
          setSymbols(cached.symbols);
          setIsLive(true);
          setLoaded(true);
          setError(null);
          if (Date.now() - cached.ts < CACHE_TTL_MS) {
            // Cache fresh — skip network.
            return;
          }
        }
      }
      setLoading(true);
      try {
        const { data, error: invErr } = await supabase.functions.invoke("get-mt5-symbols", {
          body: {},
        });
        if (invErr) {
          setLastResponse({ success: false, error: invErr.message ?? String(invErr) });
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
          setError(list.length === 0 ? "Broker returned no symbols." : null);
          if (list.length > 0) writeCache(user.id, enriched);
        } else {
          setError(data?.error ?? "Broker symbols could not be loaded. Please refresh.");
        }
      } catch (e: any) {
        setLastResponse({ success: false, error: e?.message ?? String(e) });
        setError(e?.message ?? "Broker symbols could not be loaded. Please refresh.");
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch specs + tick for the currently selected symbol.
  // Initial call resolves specs; a 4s poll keeps the bid/ask tick live.
  useEffect(() => {
    if (!user) {
      setSelectedSymbolValid(false);
      setSelectedSymbolInfo(null);
      setTick(null);
      return;
    }
    const sym = normalize(selectedBrokerSymbol);
    if (!sym) return;
    let cancelled = false;
    const fetchOnce = async (isInitial: boolean) => {
      try {
        const { data, error: invErr } = await supabase.functions.invoke(
          "get-mt5-symbol-data",
          { body: { debug: true, selectedSymbol: sym } },
        );
        if (cancelled) return;
        if (invErr) {
          if (isInitial) {
            setLastSymbolDataResponse({ success: false, error: invErr.message ?? String(invErr) });
            setSelectedSymbolValid(false);
            setSelectedSymbolInfo(null);
            setTick(null);
          }
          return;
        }
        setLastSymbolDataResponse(data);
        if (data?.success === true) {
          setSelectedSymbolValid(data.selectedSymbolValid === true);
          if (data.selectedSymbolInfo) setSelectedSymbolInfo(data.selectedSymbolInfo);
          if (data.tick) setTick(data.tick);
        } else if (isInitial) {
          setSelectedSymbolValid(false);
          setSelectedSymbolInfo(null);
          setTick(null);
        }
      } catch (e: any) {
        if (cancelled || !isInitial) return;
        setLastSymbolDataResponse({ success: false, error: e?.message ?? String(e) });
        setSelectedSymbolValid(false);
        setSelectedSymbolInfo(null);
        setTick(null);
      }
    };
    // Reset on symbol change
    setTick(null);
    setSelectedSymbolInfo(null);
    setSelectedSymbolValid(false);
    fetchOnce(true);
    const id = window.setInterval(() => fetchOnce(false), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, selectedBrokerSymbol]);

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
      lastSymbolDataResponse,
      refresh,
      setSelectedBrokerSymbol,
    }),
    [symbols, isLive, loading, loaded, error, selectedSymbolValid, selectedSymbolInfo, tick, lastResponse, lastSymbolDataResponse, refresh],
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
      lastSymbolDataResponse: null,
      refresh: async () => {},
      setSelectedBrokerSymbol: () => {},
    };
  }
  return ctx;
}
