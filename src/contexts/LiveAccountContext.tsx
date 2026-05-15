import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LiveAccount {
  login: string;
  server: string;
  status: string;
  currency: string;
  leverage: number | null;
  balance: number;
  equity: number;
  margin: number;
  marginFree: number;
  profit: number;
  openPositionsCount: number;
  lastSynced: string | null;
}

export interface LivePosition {
  ticket: string | number | null;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entry_price: number;
  current_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
}

interface LiveAccountCtx {
  liveAccount: LiveAccount | null;
  positions: LivePosition[];
  connected: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<LiveAccountCtx | null>(null);

const REFRESH_MS = 10_000;

export function LiveAccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [liveAccount, setLiveAccount] = useState<LiveAccount | null>(null);
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setConnected(false);
      setLiveAccount(null);
      setPositions([]);
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      const { data: res, error: invErr } = await supabase.functions.invoke(
        "get-live-account",
        { body: { refresh: true, debug: true } },
      );
      if (invErr) throw invErr;
      if (res?.success === true) {
        setLiveAccount((res.account ?? null) as LiveAccount | null);
        setPositions((res.positions ?? []) as LivePosition[]);
        setConnected(true);
        setError(null);
      } else {
        setLiveAccount(null);
        setPositions([]);
        setConnected(false);
        setError(res?.error ?? null);
      }
    } catch (e: any) {
      setLiveAccount(null);
      setPositions([]);
      setConnected(false);
      setError(e?.message ?? "Failed to reach the trading service.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    // Initial fetch on mount.
    refresh();

    let intervalId: number | null = null;
    const start = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, REFRESH_MS);
    };
    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Refresh immediately when the tab becomes visible, then resume polling.
        refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    const onTrade = () => refresh();
    window.addEventListener("trade-executed", onTrade);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("trade-executed", onTrade);
    };
  }, [refresh]);

  const value = useMemo<LiveAccountCtx>(
    () => ({ liveAccount, positions, connected, loading, refreshing, error, refresh }),
    [liveAccount, positions, connected, loading, refreshing, error, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveAccount(): LiveAccountCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback for components rendered outside the provider.
    return {
      liveAccount: null,
      positions: [],
      connected: false,
      loading: false,
      refreshing: false,
      error: null,
      refresh: async () => {},
    };
  }
  return ctx;
}

/** Format a numeric live-account field. Shows "—" when value is null/undefined/NaN, but renders 0 if it really is 0. */
export function fmtMoney(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toString();
}
