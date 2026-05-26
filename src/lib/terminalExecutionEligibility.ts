/**
 * Client helper for the Order Ticket execution eligibility resolver.
 *
 * Calls the `get-terminal-execution-eligibility` edge function which is the
 * single backend source of truth used by the BlackArrow Order Ticket to
 * decide whether BUY @ MKT and SELL @ MKT are enabled for the currently
 * selected symbol. The mutation path (submit-best-execution-order) performs
 * its own independent re-resolution — the UI must not trust this response
 * for live order submission, only for display + button enablement.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TerminalExecutionEligibility {
  success: boolean;
  version?: string;
  executionPolicyVersion?: string;
  displaySymbol: string | null;
  canonicalSymbol: string | null;
  brokerSymbol: string | null;
  brokerSymbolResolution:
    | "resolved_unique_verified"
    | "resolved_unique_verified_ack_required"
    | "ambiguous_multiple_executable_variants"
    | "unresolved"
    | "no_mt5_mapping"
    | "stale_mapping";
  ambiguousVariants?: string[] | null;
  routeVerified: boolean;
  routeAccountIdMasked?: string | null;
  tradeAllowed?: boolean | null;
  accountTradeModeRaw?: number | null;
  accountTradeModeLabel?: string | null;
  symbolTradeModeRaw?: number | null;
  symbolTradeModeLabel?: string | null;
  volumeMin?: number | null;
  volumeStep?: number | null;
  discrepancyAcknowledged?: boolean;
  buyReady: boolean;
  buyBlockedReason: string | null;
  sellReady: boolean;
  sellBlockedReason: string | null;
  blockedReason?: string | null;
  message?: string | null;
  checkedAt?: string | null;
  /** Client-side: populated when the network call itself failed. */
  fetchError?: string | null;
}

export async function fetchTerminalExecutionEligibility(
  symbol: string,
): Promise<TerminalExecutionEligibility> {
  const { data, error } = await supabase.functions.invoke(
    "get-terminal-execution-eligibility",
    { body: { symbol } },
  );
  if (error) {
    return {
      success: false,
      displaySymbol: symbol,
      canonicalSymbol: symbol.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      brokerSymbol: null,
      brokerSymbolResolution: "unresolved",
      routeVerified: false,
      buyReady: false, sellReady: false,
      buyBlockedReason: "ELIGIBILITY_FETCH_FAILED",
      sellBlockedReason: "ELIGIBILITY_FETCH_FAILED",
      blockedReason: "ELIGIBILITY_FETCH_FAILED",
      message: error.message,
      fetchError: error.message,
      checkedAt: new Date().toISOString(),
    };
  }
  return data as TerminalExecutionEligibility;
}

export interface TerminalEligibilityState {
  data: TerminalExecutionEligibility | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Subscribes the terminal to backend-authoritative execution eligibility for
 * the selected display symbol. Re-fetches when the symbol changes or any of
 * the optional reactive dependencies change (e.g. MT5 account swap, route
 * verification, ack toggled, admin live-test mode change).
 */
export function useTerminalExecutionEligibility(
  displaySymbol: string | null | undefined,
  deps: ReadonlyArray<unknown> = [],
): TerminalEligibilityState {
  const [data, setData] = useState<TerminalExecutionEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const symbol = (displaySymbol || "")
    .replace(/\//g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const cancelledRef = useRef(false);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    cancelledRef.current = false;
    if (!symbol) { setData(null); return; }
    setLoading(true);
    setError(null);
    fetchTerminalExecutionEligibility(symbol)
      .then((res) => {
        if (cancelledRef.current) return;
        setData(res);
        if (!res.success && res.fetchError) setError(res.fetchError);
      })
      .catch((e) => {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (!cancelledRef.current) setLoading(false); });
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, nonce, ...deps]);

  return { data, loading, error, refresh };
}
