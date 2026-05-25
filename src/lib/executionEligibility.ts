/**
 * Client helper for the Trading Layer execution eligibility resolver.
 * Wraps the `get-trading-execution-eligibility` edge function and caches
 * the most recent sanitized response in localStorage so admin/test UIs
 * can render the last known state instantly.
 */
import { supabase } from "@/integrations/supabase/client";

export type EligibilityStatus = "eligible" | "blocked" | "unknown";

export interface ExecutionEligibility {
  success: boolean;
  traderId: string | null;
  accountTradeMode: string | null;
  accountTradeEligible: boolean;
  displaySymbol: string | null;
  brokerSymbol: string | null;
  symbolTradeMode: string | null;
  symbolTradeEligible: boolean;
  eligibility: EligibilityStatus;
  blockedReason: string | null;
  checkedAt: string | null;
  catalogUpsertedCount?: number;
}

const CACHE_PREFIX = "ltr.execEligibility.";

function cacheKey(symbol: string): string {
  return `${CACHE_PREFIX}${symbol.toUpperCase()}`;
}

export function readCachedEligibility(symbol: string): ExecutionEligibility | null {
  try {
    const raw = localStorage.getItem(cacheKey(symbol));
    if (!raw) return null;
    return JSON.parse(raw) as ExecutionEligibility;
  } catch {
    return null;
  }
}

export async function fetchExecutionEligibility(
  symbol: string,
  opts?: { refresh?: boolean },
): Promise<ExecutionEligibility> {
  const refresh = opts?.refresh !== false;
  const { data, error } = await supabase.functions.invoke(
    "get-trading-execution-eligibility",
    { body: { symbol, refresh } },
  );
  if (error) {
    return {
      success: false,
      traderId: null,
      accountTradeMode: null,
      accountTradeEligible: false,
      displaySymbol: symbol,
      brokerSymbol: null,
      symbolTradeMode: null,
      symbolTradeEligible: false,
      eligibility: "unknown",
      blockedReason: error.message || "eligibility_fetch_failed",
      checkedAt: new Date().toISOString(),
    };
  }
  const result = data as ExecutionEligibility;
  try {
    localStorage.setItem(cacheKey(symbol), JSON.stringify(result));
  } catch { /* ignore */ }
  return result;
}

export function isEligibilityStale(
  e: ExecutionEligibility | null,
  maxAgeMs = 5 * 60 * 1000,
): boolean {
  if (!e || !e.checkedAt) return true;
  const t = Date.parse(e.checkedAt);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > maxAgeMs;
}
