// Server-side authoritative fresh-tick resolver for live execution validation.
//
// Always calls Trading Layer's latest-tick endpoint using:
//   - verified route accountId  (user_mt_accounts.trading_layer_account_id)
//   - exact broker symbol       (caller-resolved, e.g. "EURUSD")
//
// Returns a structured result with explicit codes. NEVER returns a fresh=true
// tick unless a real bid/ask + timestamp were observed and age <= threshold.
//
// WebSocket / frontend display ticks are NOT trusted as price-of-record.

import { getLatestTick } from "./tlClient.ts";

export const FRESH_TICK_MAX_AGE_MS = 15_000;
export const FRESH_TICK_POLICY_VERSION = "FRESH_TICK_SERVER_AUTHORITATIVE_V1_2026_05_26";

export const FRESH_TICK_OK = "FRESH_TICK_OK";
export const FRESH_TICK_UNAVAILABLE = "FRESH_TICK_UNAVAILABLE";
export const FRESH_TICK_STALE = "FRESH_TICK_STALE";
export const FRESH_TICK_PROVIDER_ERROR = "FRESH_TICK_PROVIDER_ERROR";
export const FRESH_TICK_RATE_LIMITED = "FRESH_TICK_RATE_LIMITED";
export const FRESH_TICK_MISSING_ROUTE = "FRESH_TICK_MISSING_ROUTE";
export const FRESH_TICK_MISSING_SYMBOL = "FRESH_TICK_MISSING_SYMBOL";

export interface FreshTickResult {
  fresh: boolean;
  code: string;
  message: string;
  displaySymbol: string | null;
  brokerSymbol: string | null;
  routeAccountIdMasked: string | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  timestamp: string | null;
  ageMs: number | null;
  thresholdMs: number;
  source: string;
  policyVersion: string;
  upstreamStatus: number | null;
}

function mask(id: string | null | undefined): string | null {
  if (!id) return null;
  const s = String(id);
  if (s.length <= 8) return s;
  return `${s.slice(0, 3)}…${s.slice(-4)}`;
}

function parseTickTimestamp(tick: any): { iso: string | null; ms: number | null } {
  const candidate =
    tick?.timestamp ?? tick?.time ?? tick?.ts ?? tick?.serverTime ?? tick?.server_time ?? null;
  if (candidate == null) return { iso: null, ms: null };
  // Could be ISO string or epoch ms/seconds.
  if (typeof candidate === "number") {
    const ms = candidate > 10_000_000_000 ? candidate : candidate * 1000;
    return { iso: new Date(ms).toISOString(), ms };
  }
  const n = Date.parse(String(candidate));
  if (!Number.isFinite(n)) return { iso: null, ms: null };
  return { iso: new Date(n).toISOString(), ms: n };
}

export async function resolveFreshExecutionTick(params: {
  routeAccountId: string | null;
  brokerSymbol: string | null;
  displaySymbol?: string | null;
  maxAgeMs?: number;
}): Promise<FreshTickResult> {
  const thresholdMs = params.maxAgeMs ?? FRESH_TICK_MAX_AGE_MS;
  const base: FreshTickResult = {
    fresh: false,
    code: FRESH_TICK_UNAVAILABLE,
    message: "Live order blocked: no fresh server-side quote is available for execution validation.",
    displaySymbol: params.displaySymbol ?? params.brokerSymbol ?? null,
    brokerSymbol: params.brokerSymbol ?? null,
    routeAccountIdMasked: mask(params.routeAccountId),
    bid: null,
    ask: null,
    spread: null,
    timestamp: null,
    ageMs: null,
    thresholdMs,
    source: "trading_layer_latest_tick",
    policyVersion: FRESH_TICK_POLICY_VERSION,
    upstreamStatus: null,
  };

  if (!params.routeAccountId) {
    return {
      ...base,
      code: FRESH_TICK_MISSING_ROUTE,
      message: "Live order blocked: no verified execution route is available for tick validation.",
    };
  }
  if (!params.brokerSymbol) {
    return {
      ...base,
      code: FRESH_TICK_MISSING_SYMBOL,
      message: "Live order blocked: exact broker symbol is unresolved for tick validation.",
    };
  }

  let upstream: Awaited<ReturnType<typeof getLatestTick>>;
  try {
    upstream = await getLatestTick(params.routeAccountId, params.brokerSymbol);
  } catch (err) {
    return {
      ...base,
      code: FRESH_TICK_PROVIDER_ERROR,
      message: "Live order blocked: execution quote validation is temporarily unavailable.",
      upstreamStatus: null,
    };
  }

  base.upstreamStatus = upstream.status ?? null;

  if (!upstream.ok) {
    if (upstream.status === 429) {
      return {
        ...base,
        code: FRESH_TICK_RATE_LIMITED,
        message: "Live order blocked: quote validation is temporarily rate-limited. Please wait before trying again.",
      };
    }
    return {
      ...base,
      code: FRESH_TICK_PROVIDER_ERROR,
      message: "Live order blocked: execution quote validation is temporarily unavailable.",
    };
  }

  const tick = upstream.data ?? null;
  const bid = tick?.bid != null ? Number(tick.bid) : null;
  const ask = tick?.ask != null ? Number(tick.ask) : null;
  const { iso, ms } = parseTickTimestamp(tick);

  if (bid == null || ask == null) {
    return {
      ...base,
      code: FRESH_TICK_UNAVAILABLE,
      message: "Live order blocked: no fresh server-side quote is available for execution validation.",
      timestamp: iso,
    };
  }

  const nowMs = Date.now();
  const ageMs = ms != null ? Math.max(0, nowMs - ms) : null;
  const spread = Math.max(0, ask - bid);

  if (ageMs == null) {
    // No timestamp — treat as unavailable, never trust.
    return {
      ...base,
      code: FRESH_TICK_UNAVAILABLE,
      message: "Live order blocked: no fresh server-side quote timestamp is available for execution validation.",
      bid,
      ask,
      spread,
      timestamp: iso,
    };
  }

  if (ageMs > thresholdMs) {
    return {
      ...base,
      code: FRESH_TICK_STALE,
      message: "Live order blocked: the server-side execution quote is stale. Refresh prices and try again.",
      bid,
      ask,
      spread,
      timestamp: iso,
      ageMs,
    };
  }

  return {
    ...base,
    fresh: true,
    code: FRESH_TICK_OK,
    message: "Fresh server-side execution tick validated.",
    bid,
    ask,
    spread,
    timestamp: iso,
    ageMs,
  };
}
