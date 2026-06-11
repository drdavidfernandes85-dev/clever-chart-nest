/**
 * useTerminalProAccountSnapshot
 * -----------------------------
 * Atomic account snapshot for /terminal-pro.
 *
 * Why a separate hook (not useLiveAccount):
 * MarketDataService merges each field independently with a stale-while-revalidate
 * fallback (treating 0 as "missing"), so Balance / Equidad / Margen / P&L can
 * drift apart across snapshots. The Phase 1 brief requires all six values to
 * come from the SAME response.
 *
 * This hook calls `get-mt5-terminal-data` directly and replaces the snapshot
 * atomically per refresh. The existing TradingDashboard/live-terminal stack is
 * untouched.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AtomicAccountSnapshot {
  login: string;
  server: string;
  currency: string;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  marginFree: number | null;
  profit: number | null;
  openPositionsCount: number;
  /** Server-side timestamp of the response (ms epoch). All 6 values were
   *  consistent at this instant per the broker. */
  asOf: number;
}

interface State {
  snapshot: AtomicAccountSnapshot | null;
  loading: boolean;
  error: string | null;
  /** True when the user has a connected MT account at all. */
  connected: boolean;
}

const REFRESH_MS = 5_000;

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function useTerminalProAccountSnapshot(): State & { refresh: () => void } {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    snapshot: null,
    loading: true,
    error: null,
    connected: false,
  });
  const inFlightRef = useRef(false);

  const fetchOnce = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-mt5-terminal-data",
        { body: {} },
      );
      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }
      const connected = data?.success === true && data?.accountConnected !== false;
      if (!connected) {
        setState({ snapshot: null, loading: false, error: null, connected: false });
        return;
      }
      const a = data?.account ?? {};
      // ATOMIC: take all six values from this single `account` object — no
      // per-field merge, no fallback to a previous snapshot. If a value is
      // missing in this response, it is rendered as `—` rather than a stale
      // value from another point in time.
      const snapshot: AtomicAccountSnapshot = {
        login: String(a.login ?? ""),
        server: String(a.server ?? ""),
        currency: String(a.currency ?? "USD"),
        balance: num(a.balance),
        equity: num(a.equity),
        margin: num(a.margin),
        marginFree: num(a.marginFree),
        profit: num(a.profit),
        openPositionsCount: Number(a.openPositionsCount ?? 0),
        asOf: Date.now(),
      };
      setState({ snapshot, loading: false, error: null, connected: true });
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message || "Network error" }));
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!user) {
      setState({ snapshot: null, loading: false, error: null, connected: false });
      return;
    }
    fetchOnce();
    const id = window.setInterval(fetchOnce, REFRESH_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { ...state, refresh: fetchOnce };
}
