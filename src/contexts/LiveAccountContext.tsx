import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";
import { MarketDataService } from "@/services/MarketDataService";
import { tradingLayerMarketDataWebSocket } from "@/services/tradingLayerMarketDataWebSocket";
import { liveMarketDataStore } from "@/lib/liveMarketDataStore";

export interface LiveAccount {
  login: string;
  server: string;
  status: string;
  currency: string;
  leverage: number | null;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  marginFree: number | null;
  profit: number | null;
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

export function LiveAccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { selectedBrokerSymbol } = useBrokerSymbols();
  const [liveAccount, setLiveAccount] = useState<LiveAccount | null>(null);
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Manual refresh — delegates to the centralized service.
  const refresh = useCallback(async () => {
    if (!user) {
      setConnected(false);
      setLiveAccount(null);
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setRefreshing(true);
    try {
      MarketDataService.refreshAccountAndPositions();
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Start the centralized MarketDataService once a user is present and bridge
  // its store snapshots into this context's state so existing consumers keep
  // working with the same API.
  useEffect(() => {
    if (!user) {
      MarketDataService.stop();
      return;
    }
    MarketDataService.start();
    const unsub = liveMarketDataStore.subscribe((s) => {
      // Account
      if (s.account) {
        setLiveAccount(s.account as LiveAccount);
        setConnected(s.status !== "disconnected");
      } else if (s.status === "disconnected") {
        setConnected(false);
      }
      // Positions — always reflect what the store has.
      setPositions(s.positions as LivePosition[]);
      setError(s.lastError);
      setLoading(false);
    });
    return () => {
      unsub();
    };
  }, [user]);

  // Tell both services which symbol is currently selected.
  useEffect(() => {
    MarketDataService.setSelectedSymbol(selectedBrokerSymbol || "");
    tradingLayerMarketDataWebSocket.setSelectedSymbol(selectedBrokerSymbol || "");
  }, [selectedBrokerSymbol]);

  // Resolve the user's MT account UUID + TL accountId so we can scope
  // realtime filters AND start the Trading Layer market-data WebSocket.
  const [tlAccountId, setTlAccountId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAccountId(null);
      setTlAccountId(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_mt_accounts")
        .select("id, metaapi_account_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setAccountId(data?.id ?? null);
        setTlAccountId(data?.metaapi_account_id ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, liveAccount?.login]);

  // Start the Trading Layer market-data WebSocket once we have the TL
  // accountId. Display-only — execution stays on the backend fresh-tick
  // validation path.
  useEffect(() => {
    if (!user || !tlAccountId) {
      tradingLayerMarketDataWebSocket.stop();
      return;
    }
    tradingLayerMarketDataWebSocket.start(tlAccountId);
    return () => {
      tradingLayerMarketDataWebSocket.stop();
    };
  }, [user, tlAccountId]);

  // Realtime: subscribe scoped to the current account and selected symbol.
  // DB-side changes trigger a service refresh — no independent polling here.
  useEffect(() => {
    if (!user) return;
    const sym = (selectedBrokerSymbol || "").toUpperCase();
    const channelName = `live-account-${user.id}-${accountId ?? "none"}-${sym || "all"}`;
    let ch = supabase.channel(channelName);

    const trigger = () => MarketDataService.refreshAccountAndPositions();

    if (accountId) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_mt_accounts", filter: `id=eq.${accountId}` },
        trigger,
      );
      // mt_positions dependency removed — live positions come from Trading Layer.

      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_execution_logs", filter: `account_id=eq.${accountId}` },
        (payload: any) => {
          if (!sym) return trigger();
          const row = payload.new ?? payload.old ?? {};
          if (String(row.symbol ?? "").toUpperCase() === sym) trigger();
        },
      );
    } else {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_mt_accounts", filter: `user_id=eq.${user.id}` },
        trigger,
      );
    }

    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, accountId, selectedBrokerSymbol]);

  const value = useMemo<LiveAccountCtx>(
    () => ({ liveAccount, positions, connected, loading, refreshing, error, refresh }),
    [liveAccount, positions, connected, loading, refreshing, error, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveAccount(): LiveAccountCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
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
