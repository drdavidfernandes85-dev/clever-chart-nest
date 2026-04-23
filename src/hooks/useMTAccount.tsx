import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MTAccount {
  id: string;
  user_id: string;
  platform: "mt4" | "mt5";
  account_type: "live" | "demo";
  broker_name: string;
  server_name: string;
  login: string;
  nickname: string | null;
  status: "pending" | "syncing" | "connected" | "error" | "disconnected";
  status_message: string | null;
  last_error: string | null;
  last_synced_at: string | null;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  free_margin: number | null;
  margin_level: number | null;
  currency: string | null;
  leverage: number | null;
  metaapi_account_id: string | null;
  region: string | null;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface MTPosition {
  id: string;
  account_id: string;
  ticket: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  open_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  swap: number | null;
  commission: number | null;
  profit: number | null;
  opened_at: string;
}

export interface MTSnapshot {
  id: string;
  account_id: string;
  balance: number;
  equity: number;
  recorded_at: string;
}

/**
 * Returns the user's primary MT account + open positions + equity curve.
 *
 * - Syncs every 30s while connected (real MetaApi pull)
 * - Polls every 15s while status === "syncing" (provisioning / deploy)
 */
export function useMTAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<MTAccount | null>(null);
  const [positions, setPositions] = useState<MTPosition[]>([]);
  const [snapshots, setSnapshots] = useState<MTSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const lastSyncRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      setPositions([]);
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: acc } = await (supabase as any)
      .from("user_mt_accounts_safe")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!acc) {
      setAccount(null);
      setPositions([]);
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setAccount(acc as MTAccount);

    const [posRes, snapRes] = await Promise.all([
      (supabase as any)
        .from("mt_positions")
        .select("*")
        .eq("account_id", acc.id)
        .order("opened_at", { ascending: false }),
      (supabase as any)
        .from("mt_account_snapshots")
        .select("*")
        .eq("account_id", acc.id)
        .order("recorded_at", { ascending: true })
        .limit(60),
    ]);

    setPositions((posRes.data ?? []) as MTPosition[]);
    setSnapshots((snapRes.data ?? []) as MTSnapshot[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sync = useCallback(
    async (accountId?: string) => {
      const id = accountId ?? account?.id;
      if (!id) return { error: "No account" };
      setSyncing(true);
      lastSyncRef.current = Date.now();
      try {
        const { data, error } = await (supabase as any).functions.invoke(
          "sync-mt-account",
          { body: { account_id: id } },
        );
        if (error) throw error;
        await refresh();
        return { data };
      } catch (err: any) {
        return { error: err?.message ?? String(err) };
      } finally {
        setSyncing(false);
      }
    },
    [account, refresh],
  );

  // ---- Background poller ----
  // - While syncing: poll every 15s to track MetaApi provisioning
  // - While connected: pull live data every 30s
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      // Skip if a manual sync was started in the last 10s
      if (Date.now() - lastSyncRef.current < 10_000) return;
      await sync(account.id);
    };
    const interval =
      account.status === "syncing" || account.status === "pending"
        ? 15_000
        : account.status === "connected"
          ? 30_000
          : 0;
    if (!interval) return;
    const handle = setInterval(tick, interval);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [account, sync]);

  return { account, positions, snapshots, loading, syncing, sync, refresh };
}
