import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";
import { isAutoRefreshAllowed } from "@/lib/tradingLayerControl";

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

const REFRESH_MS = 10_000;

const num = (v: any): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

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

  const refresh = useCallback(async () => {
    if (!user) {
      // Real logout — safe to clear.
      setConnected(false);
      setLiveAccount(null);
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setRefreshing(true);
    try {
      const { data: res, error: invErr } = await supabase.functions.invoke(
        "get-mt5-terminal-data",
        { body: {} },
      );
      if (invErr) throw invErr;

      const isConnected =
        res?.success === true || res?.accountConnected === true;

      if (isConnected) {
        const a = res.account ?? null;
        const d = res.data ?? {};
        const incoming: LiveAccount = {
          login: String(a?.login ?? d?.account_number ?? ""),
          server: String(a?.server ?? d?.server ?? ""),
          status: String(a?.status ?? d?.status ?? "connected"),
          currency: a?.currency ?? d?.currency ?? "USD",
          leverage: a?.leverage ?? d?.leverage ?? null,
          balance: num(a?.balance ?? d?.balance),
          equity: num(a?.equity ?? d?.equity),
          margin: num(a?.margin ?? d?.margin),
          marginFree: num(a?.marginFree ?? a?.free_margin ?? d?.free_margin),
          profit: num(a?.profit ?? d?.floating_pnl),
          openPositionsCount: Number(
            a?.openPositionsCount ?? d?.open_positions ?? 0,
          ),
          lastSynced: a?.lastSynced ?? d?.last_synced ?? null,
        };

        // Stale-while-revalidate: never overwrite a known-good snapshot with
        // an empty/all-zero refresh. A response with no login AND zero/null
        // balance, equity, and margin is treated as "no data this tick".
        const incomingHasFigures =
          (incoming.balance != null && incoming.balance !== 0) ||
          (incoming.equity != null && incoming.equity !== 0) ||
          (incoming.margin != null && incoming.margin !== 0) ||
          (incoming.marginFree != null && incoming.marginFree !== 0) ||
          (incoming.profit != null && incoming.profit !== 0);
        const incomingHasIdentity = incoming.login !== "" || incoming.server !== "";

        setLiveAccount((prev) => {
          if (!prev) {
            // First snapshot — always accept, even if all zeros (could be a real flat account).
            return incoming;
          }
          // Field-level merge: prefer incoming values when meaningful,
          // otherwise keep last good. This prevents flicker to $0.00.
          const pickNum = (next: number | null, last: number | null) =>
            next != null && next !== 0 ? next : (next === 0 && last == null ? 0 : last);
          const pickStr = (next: string, last: string) => (next ? next : last);
          if (!incomingHasFigures && !incomingHasIdentity) {
            // Nothing useful — keep last good entirely.
            return prev;
          }
          return {
            login: pickStr(incoming.login, prev.login),
            server: pickStr(incoming.server, prev.server),
            status: pickStr(incoming.status, prev.status),
            currency: incoming.currency || prev.currency,
            leverage: incoming.leverage ?? prev.leverage,
            balance: pickNum(incoming.balance, prev.balance),
            equity: pickNum(incoming.equity, prev.equity),
            margin: pickNum(incoming.margin, prev.margin),
            marginFree: pickNum(incoming.marginFree, prev.marginFree),
            profit: incoming.profit ?? prev.profit,
            openPositionsCount: incoming.openPositionsCount,
            lastSynced: incoming.lastSynced ?? prev.lastSynced,
          };
        });
        setConnected(true);

        const nextPositions = (res.positions ?? d?.positions ?? []) as LivePosition[];
        if (Array.isArray(nextPositions)) {
          // Always set positions array (empty array IS valid info — no open positions).
          setPositions(nextPositions);
        }
        setError(null);

      } else {
        // Not connected per broker. Keep last known good account/positions visible.
        // Only surface the error message; never blank the panel during polling.
        setError(res?.error ?? "Trading service did not return account data.");
      }
    } catch (e: any) {
      // Network / function error — keep previous data on screen (stale-while-revalidate).
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
        if (document.visibilityState === "visible" && isAutoRefreshAllowed()) refresh();
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
  }, [refresh, user]);

  // Resolve the user's MT account UUID so we can scope realtime filters.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAccountId(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_mt_accounts")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setAccountId(data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, liveAccount?.login]);

  // Realtime: subscribe scoped to the current account and selected symbol.
  // Resubscribes whenever account or symbol changes.
  useEffect(() => {
    if (!user) return;
    const sym = (selectedBrokerSymbol || "").toUpperCase();
    const channelName = `live-account-${user.id}-${accountId ?? "none"}-${sym || "all"}`;
    let ch = supabase.channel(channelName);

    if (accountId) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_mt_accounts", filter: `id=eq.${accountId}` },
        () => refresh(),
      );
      const posFilter = sym
        ? `account_id=eq.${accountId}` // postgres_changes supports only a single filter; symbol filtered client-side via refresh
        : `account_id=eq.${accountId}`;
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mt_positions", filter: posFilter },
        (payload: any) => {
          if (!sym) return refresh();
          const row = payload.new ?? payload.old ?? {};
          if (String(row.symbol ?? "").toUpperCase() === sym) refresh();
        },
      );
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_execution_logs", filter: `account_id=eq.${accountId}` },
        (payload: any) => {
          if (!sym) return refresh();
          const row = payload.new ?? payload.old ?? {};
          if (String(row.symbol ?? "").toUpperCase() === sym) refresh();
        },
      );
    } else {
      // No account yet — fall back to user-scoped account changes only.
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_mt_accounts", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      );
    }

    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, accountId, selectedBrokerSymbol, refresh]);

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
