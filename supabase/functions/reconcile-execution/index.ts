// reconcile-execution
//
// Post-trade reconciliation against the Trading Layer MT5 REST API.
//
// After a broker call returns (often with retcode 10008 / "placed"), this
// function checks whether the request actually became:
//   A. an open position   → status: position_confirmed
//   B. a closed deal      → status: deal_found_no_open_position
//   C. a pending order    → status: order_found_not_filled
//   D. nothing at all     → status: execution_unconfirmed
//
// Endpoints used (verified against https://api.trading-layer.com/openapi.json):
//   GET /api/v1/traders/{traderId}                      → account/trader status
//   GET /api/v1/accounts/{accountId}/positions          → open positions
//   GET /api/v1/accounts/{accountId}/orders             → active (pending) orders
//   GET /api/v1/accounts/{accountId}/history/orders     → recent order history
//   GET /api/v1/accounts/{accountId}/history/deals      → recent deal/fill history
//
// `accountId` in the URL maps to `user_mt_accounts.metaapi_account_id`,
// which is also the Trading Layer trader/account id (same convention used
// by get-live-account and submit-best-execution-order).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  resolveActiveMtMapping,
  STALE_MAPPING_ERROR_CODE,
  STALE_MAPPING_USER_MESSAGE,
} from "../_shared/mtMapping.ts";

const VERSION = "reconcile-execution@1.5.0";
const RATE_LIMIT_DEFAULT_SECONDS = 60;
const reconcileInFlight = new Map<string, number>();
const accountCooldowns = new Map<string, { cooldownUntil: number; retryAfter: number; endpoint: string; avoided: number }>();

// MT5 TRADE_RETCODE → short name + human description.
// Only well-known codes are mapped; anything else returns null/null.
const MT5_RETCODES: Record<number, { name: string; description: string }> = {
  10004: { name: "TRADE_RETCODE_REQUOTE", description: "Requote" },
  10006: { name: "TRADE_RETCODE_REJECT", description: "Request rejected" },
  10007: { name: "TRADE_RETCODE_CANCEL", description: "Request canceled by trader" },
  10008: { name: "TRADE_RETCODE_PLACED", description: "Order placed" },
  10009: { name: "TRADE_RETCODE_DONE", description: "Request completed" },
  10010: { name: "TRADE_RETCODE_DONE_PARTIAL", description: "Only part of the request was completed" },
  10011: { name: "TRADE_RETCODE_ERROR", description: "Request processing error" },
  10012: { name: "TRADE_RETCODE_TIMEOUT", description: "Request canceled by timeout" },
  10013: { name: "TRADE_RETCODE_INVALID", description: "Invalid request" },
  10014: { name: "TRADE_RETCODE_INVALID_VOLUME", description: "Invalid volume in the request" },
  10015: { name: "TRADE_RETCODE_INVALID_PRICE", description: "Invalid price in the request" },
  10016: { name: "TRADE_RETCODE_INVALID_STOPS", description: "Invalid stops in the request" },
  10017: { name: "TRADE_RETCODE_TRADE_DISABLED", description: "Trade is disabled" },
  10018: { name: "TRADE_RETCODE_MARKET_CLOSED", description: "Market is closed" },
  10019: { name: "TRADE_RETCODE_NO_MONEY", description: "Insufficient funds" },
  10020: { name: "TRADE_RETCODE_PRICE_CHANGED", description: "Prices changed" },
  10021: { name: "TRADE_RETCODE_PRICE_OFF", description: "No quotes to process the request" },
  10022: { name: "TRADE_RETCODE_INVALID_EXPIRATION", description: "Invalid order expiration date" },
  10023: { name: "TRADE_RETCODE_ORDER_CHANGED", description: "Order state changed" },
  10024: { name: "TRADE_RETCODE_TOO_MANY_REQUESTS", description: "Too frequent requests" },
  10025: { name: "TRADE_RETCODE_NO_CHANGES", description: "No changes in request" },
  10026: { name: "TRADE_RETCODE_SERVER_DISABLES_AT", description: "Autotrading disabled by server" },
  10027: { name: "TRADE_RETCODE_CLIENT_DISABLES_AT", description: "Autotrading disabled by client terminal" },
  10028: { name: "TRADE_RETCODE_LOCKED", description: "Request locked for processing" },
  10029: { name: "TRADE_RETCODE_FROZEN", description: "Order or position frozen" },
  10030: { name: "TRADE_RETCODE_INVALID_FILL", description: "Invalid order filling type" },
  10031: { name: "TRADE_RETCODE_CONNECTION", description: "No connection with the trade server" },
  10032: { name: "TRADE_RETCODE_ONLY_REAL", description: "Operation allowed only for live accounts" },
  10033: { name: "TRADE_RETCODE_LIMIT_ORDERS", description: "Number of pending orders limit reached" },
  10034: { name: "TRADE_RETCODE_LIMIT_VOLUME", description: "Volume limit for orders/positions reached" },
};

const lookupRetcode = (code: unknown): { retcodeName: string | null; retcodeDescription: string | null } => {
  const n = Number(code);
  if (!Number.isFinite(n)) return { retcodeName: null, retcodeDescription: null };
  const hit = MT5_RETCODES[n];
  return hit
    ? { retcodeName: hit.name, retcodeDescription: hit.description }
    : { retcodeName: null, retcodeDescription: null };
};
const TL_BASE = "https://api.trading-layer.com/api/v1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// MT5 enum mapping (Mt5Position / Mt5Order / Mt5HistoryOrder).
// Position type: 0=BUY, 1=SELL.
// Order type:    0=BUY, 1=SELL, 2=BUY_LIMIT, 3=SELL_LIMIT, 4=BUY_STOP, 5=SELL_STOP, ...
const mt5TypeToSide = (t: any): "buy" | "sell" | null => {
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if ([0, 2, 4, 6].includes(n)) return "buy";
  if ([1, 3, 5, 7].includes(n)) return "sell";
  return null;
};

const eq = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
// Volume tolerance: 0.005 lots absolute OR 1% relative — whichever is larger.
const volEq = (a: number, b: number) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const tol = Math.max(0.005, Math.abs(b) * 0.01);
  return Math.abs(a - b) <= tol;
};

// Suffix-tolerant broker symbol comparison.
// "XAUUSD" must match "XAUUSD.M", "XAUUSD-T", "XAUUSDm", etc.
const symEq = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  const A = String(a).toUpperCase();
  const B = String(b).toUpperCase();
  if (A === B) return true;
  const strip = (s: string) => s.replace(/[._\-\s]+/g, "").replace(/[A-Z]+$/i, (m) => m.length <= 2 ? "" : m);
  // Compare with all non-alphanumeric stripped, and with trailing 1-2 letter
  // suffixes removed ("XAUUSDm" → "XAUUSD"). We never strip > 2 trailing
  // letters because that would conflate distinct symbols.
  return strip(A) === strip(B) || A.startsWith(B) || B.startsWith(A);
};

// Pick a value across many possible field shapes.
const pickId = (obj: any, paths: string[]): string | null => {
  if (!obj || typeof obj !== "object") return null;
  for (const path of paths) {
    const v = path.split(".").reduce<any>(
      (acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined),
      obj,
    );
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
};

type ReconcileInput = {
  tradeId?: string | null;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  requestedPrice?: number | null;
  clientClickAt?: string | null;
  brokerRetcode?: number | null;
  brokerMessage?: string | null;
  rawExecutionResponse?: any;
  // ID-first matching keys forwarded by the client from the order response.
  positionTicket?: string | null;
  orderId?: string | null;
  dealId?: string | null;
  requestId?: string | null;
  clientOrderId?: string | null;
  brokerSymbol?: string | null;
};

const parseRetryAfter = (value: string | null): number | null => {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.ceil(numeric);
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) return Math.max(1, Math.ceil((asDate - Date.now()) / 1000));
  return null;
};

const extractArray = (data: any): any[] => {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.positions)) return data.positions;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.deals)) return data.deals;
  if (Array.isArray(data)) return data;
  return [];
};

async function tlFetch(
  path: string,
  qs: Record<string, string | number | undefined>,
  apiKey: string,
): Promise<{ ok: boolean; status: number; data: any; error?: string; retryAfter: number | null }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(qs)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const url = `${TL_BASE}${path}${params.toString() ? `?${params}` : ""}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    const text = await res.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { _raw: text }; }
    return { ok: res.ok, status: res.status, data: body, retryAfter: parseRetryAfter(res.headers.get("retry-after")) };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : String(e), retryAfter: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, version: VERSION, error: "POST only" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { ok: false, version: VERSION, error: "Missing Authorization header" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const TL_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!TL_KEY) {
    return json(500, { ok: false, version: VERSION, error: "Missing TRADING_LAYER_API_KEY" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, { ok: false, version: VERSION, error: "Not authenticated" });
  }
  const userId = userData.user.id;

  let input: ReconcileInput;
  try {
    input = await req.json();
  } catch {
    return json(400, { ok: false, version: VERSION, error: "Invalid JSON body" });
  }

  const wantSym = String(input?.symbol || "").toUpperCase();
  const wantSide = String(input?.side || "").toLowerCase() as "buy" | "sell";
  const wantVol = Number(input?.volume);

  if (!wantSym || (wantSide !== "buy" && wantSide !== "sell") || !Number.isFinite(wantVol)) {
    return json(400, {
      ok: false,
      version: VERSION,
      error: "Missing/invalid required fields: symbol, side, volume",
    });
  }

  const reconcileKey = input.tradeId || `${userId}:${wantSym}:${wantSide}:${wantVol}`;
  const inFlightAt = reconcileInFlight.get(reconcileKey);
  if (inFlightAt && Date.now() - inFlightAt < 30_000) {
    return json(202, {
      ok: false,
      version: VERSION,
      status: "confirmation_pending",
      confirmationStatus: "pending",
      explanation: "A confirmation check is already running for this trade. No duplicate order was sent.",
      tradeId: input.tradeId ?? null,
    });
  }
  reconcileInFlight.set(reconcileKey, Date.now());

  // ── Load the connected MT5 account via the shared mapping resolver ─────
  // This ensures reconciliation always uses the same Trading Layer trader id
  // that execute-trade resolves, even when stale ownerAccountId rows exist.
  const mapping = await resolveActiveMtMapping(supabase, userId);
  if (mapping.status === "missing") {
    reconcileInFlight.delete(reconcileKey);
    return json(200, {
      ok: false,
      version: VERSION,
      status: "execution_unconfirmed",
      mt5Confirmed: false,
      explanation: "No connected MT5 account found for this user.",
      mappingStatus: "missing",
    });
  }
  if (mapping.status === "stale" || !mapping.traderId) {
    reconcileInFlight.delete(reconcileKey);
    return json(409, {
      ok: false,
      version: VERSION,
      status: "execution_unconfirmed",
      mt5Confirmed: false,
      error: STALE_MAPPING_ERROR_CODE,
      explanation: STALE_MAPPING_USER_MESSAGE,
      mappingStatus: mapping.status,
      localRowId: mapping.localRowId,
    });
  }

  const accountId = String(mapping.traderId);
  const traderId = accountId; // Same value per get-live-account / submit convention.

  // Date window: ±10 minutes around the click (defaults to "now - 10m").
  const clickMs = input.clientClickAt ? Date.parse(input.clientClickAt) : Date.now();
  const windowFrom = new Date(clickMs - 10 * 60_000).toISOString();
  const windowTo = new Date(Date.now() + 60_000).toISOString();

  const wantPositionTicket = input.positionTicket
    ?? pickId(input.rawExecutionResponse, [
      "positionTicket", "ticket", "position.ticket", "position.id",
      "data.positionTicket", "data.ticket",
    ]);
  const wantOrderId = input.orderId
    ?? pickId(input.rawExecutionResponse, [
      "orderId", "order_id", "order.id", "order.ticket",
      "data.orderId", "data.order.ticket",
    ]);
  const wantDealId = input.dealId
    ?? pickId(input.rawExecutionResponse, [
      "dealId", "deal_id", "deal.id", "deal.ticket",
      "data.dealId", "data.deal.ticket",
    ]);
  const wantRequestId = input.requestId
    ?? input.clientOrderId
    ?? pickId(input.rawExecutionResponse, [
      "requestId", "request_id", "clientOrderId", "client_order_id", "tradeId",
    ])
    ?? (input.tradeId ?? null);

  // ── Rate-limit-safe targeted fetches against Trading Layer ──────────────
  // Never fan out to positions + pending + history orders + deals by default.
  // One invocation performs a small targeted sequence and stops immediately on 429.
  type EndpointName = "positions" | "pending" | "orders" | "deals";
  const emptyRes = (reason = "not_requested"): Awaited<ReturnType<typeof tlFetch>> => ({
    ok: false,
    status: 0,
    data: { skipped: true, reason },
    retryAfter: null,
  });
  let posRes = emptyRes();
  let ordersRes = emptyRes();
  let histOrdersRes = emptyRes();
  let histDealsRes = emptyRes();
  const calls: Array<{ endpoint: EndpointName; status: number; avoided?: boolean }> = [];
  const cooldown = accountCooldowns.get(traderId);
  let cooldownActive = !!cooldown && cooldown.cooldownUntil > Date.now();
  let requestsAvoidedDuringCooldown = cooldownActive ? (cooldown?.avoided ?? 0) + 1 : 0;
  if (cooldownActive && cooldown) accountCooldowns.set(traderId, { ...cooldown, avoided: requestsAvoidedDuringCooldown });
  const endpointPlan: EndpointName[] = wantPositionTicket
    ? ["positions", "deals"]
    : wantDealId
      ? ["deals", "positions"]
      : wantOrderId || wantRequestId
        ? ["pending", "orders"]
        : ["positions", "pending"];
  const targetLookupMode = wantPositionTicket
    ? "positionTicket"
    : wantDealId
      ? "dealId"
      : wantOrderId
        ? "orderId"
        : wantRequestId
          ? "requestId"
          : "fallback";
  try {
    if (!cooldownActive) {
      for (const endpoint of endpointPlan) {
        const res = endpoint === "positions"
          ? await tlFetch(`/accounts/${encodeURIComponent(accountId)}/positions`, { limit: 100 }, TL_KEY)
          : endpoint === "pending"
            ? await tlFetch(`/accounts/${encodeURIComponent(accountId)}/orders`, { limit: 100 }, TL_KEY)
            : endpoint === "orders"
              ? await tlFetch(`/accounts/${encodeURIComponent(accountId)}/history/orders`, { dateFrom: windowFrom, dateTo: windowTo, limit: 100 }, TL_KEY)
              : await tlFetch(`/accounts/${encodeURIComponent(accountId)}/history/deals`, { dateFrom: windowFrom, dateTo: windowTo, limit: 100 }, TL_KEY);
        calls.push({ endpoint, status: res.status });
        if (endpoint === "positions") posRes = res;
        if (endpoint === "pending") ordersRes = res;
        if (endpoint === "orders") histOrdersRes = res;
        if (endpoint === "deals") histDealsRes = res;
        if (res.status === 429) {
          const retryAfterSeconds = res.retryAfter ?? RATE_LIMIT_DEFAULT_SECONDS;
          accountCooldowns.set(traderId, {
            cooldownUntil: Date.now() + retryAfterSeconds * 1000,
            retryAfter: retryAfterSeconds,
            endpoint,
            avoided: 0,
          });
          cooldownActive = true;
          break;
        }
      }
    } else {
      calls.push({ endpoint: endpointPlan[0], status: 0, avoided: true });
    }
  } finally {
    reconcileInFlight.delete(reconcileKey);
  }

  const positions: any[] = extractArray(posRes.data);
  const pendingOrders: any[] = extractArray(ordersRes.data);
  const historyOrders: any[] = extractArray(histOrdersRes.data);
  const historyDeals: any[] = extractArray(histDealsRes.data);
  const endpointResults = { positions: posRes, orders: histOrdersRes, pending: ordersRes, deals: histDealsRes };
  const sourcesChecked = {
    positions: posRes.status !== 429 && posRes.ok,
    orders: histOrdersRes.status !== 429 && histOrdersRes.ok,
    deals: histDealsRes.status !== 429 && histDealsRes.ok,
    pending: ordersRes.status !== 429 && ordersRes.ok,
  };
  const reasonFor = (r: Awaited<ReturnType<typeof tlFetch>>): "rate_limited" | "cooldown_active" | "not_requested" | "endpoint_error" | null =>
    cooldownActive && r.status === 0 ? "cooldown_active" : r.status === 429 ? "rate_limited" : r.ok ? null : r.status === 0 ? "not_requested" : "endpoint_error";
  const sourcesSkipped = {
    positions: reasonFor(posRes),
    orders: reasonFor(histOrdersRes),
    deals: reasonFor(histDealsRes),
    pending: reasonFor(ordersRes),
  };
  const checkedCounts = {
    positionsCount: positions.length,
    ordersCount: historyOrders.length,
    dealsCount: historyDeals.length,
    pendingOrdersCount: pendingOrders.length,
  };
  const rateLimitedEntries = Object.entries(endpointResults).filter(([, r]) => r.status === 429);
  const rateLimitHit = rateLimitedEntries.length > 0 || cooldownActive;
  const retryAfter = rateLimitHit
    ? Math.max(
      cooldown?.cooldownUntil && cooldown.cooldownUntil > Date.now()
        ? Math.ceil((cooldown.cooldownUntil - Date.now()) / 1000)
        : 0,
      ...rateLimitedEntries.map(([, r]) => r.retryAfter ?? RATE_LIMIT_DEFAULT_SECONDS),
      RATE_LIMIT_DEFAULT_SECONDS,
    )
    : null;
  const nextReconcileAt = retryAfter ? new Date(Date.now() + retryAfter * 1000).toISOString() : null;

  // ── Matching ────────────────────────────────────────────────────────────
  // Match priority (most specific first):
  //   1. positionTicket / ticket / positionId
  //   2. dealId
  //   3. orderId
  //   4. requestId / clientOrderId
  //   5. (fallback) brokerSymbol + side + volume + time window
  const clickSec = Math.floor(clickMs / 1000);
  const withinTime = (t: any) => {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return true; // unknown → don't reject on time
    return Math.abs(n - clickSec) <= 600; // 10 minute window
  };

  const idOf = (o: any, paths: string[]) => pickId(o, paths);

  // Track how each match was found for audit transparency.
  // Values: "ticket" | "deal_id" | "order_id" | "request_id" |
  //         "exact_broker_symbol" | "canonical_suffix_fallback_legacy"
  let positionMatchMode: string | null = null;
  let dealMatchMode: string | null = null;
  let pendingOrderMatchMode: string | null = null;
  let historyOrderMatchMode: string | null = null;
  const supplied = String(input.brokerSymbol ?? "").trim();
  const symMatchMode = (candSym: string, recSym: string) => {
    if (supplied && candSym === supplied && String(recSym).trim() === supplied) {
      return "exact_broker_symbol";
    }
    return "canonical_suffix_fallback_legacy";
  };

  // (A) Position matching — ID first, then exact-then-suffix-tolerant symbol fallback.
  const matchedPosition = positions.find((p: any) => {
    const pTicket = idOf(p, ["ticket", "id", "identifier", "positionTicket"]);
    if (wantPositionTicket && pTicket && pTicket === wantPositionTicket) {
      positionMatchMode = "ticket"; return true;
    }
    if (wantDealId) {
      const pDeal = idOf(p, ["dealId", "deal_id", "deal.id"]);
      if (pDeal && pDeal === wantDealId) { positionMatchMode = "deal_id"; return true; }
    }
    const pSym = String(p?.symbol ?? "");
    const candSym = input.brokerSymbol ?? wantSym;
    if (!symEq(pSym, candSym)) return false;
    if (mt5TypeToSide(p?.type) !== wantSide) return false;
    if (!volEq(Number(p?.volume), wantVol)) return false;
    if (!withinTime(p?.time)) return false;
    positionMatchMode = symMatchMode(candSym, pSym);
    return true;
  });

  // (B) Deals — ID first, then fallback.
  const matchedDeal = historyDeals.find((d: any) => {
    const dId = idOf(d, ["ticket", "id", "dealId"]);
    if (wantDealId && dId && dId === wantDealId) { dealMatchMode = "deal_id"; return true; }
    if (wantOrderId) {
      const dOrd = idOf(d, ["order", "orderId", "order_id"]);
      if (dOrd && dOrd === wantOrderId) { dealMatchMode = "order_id"; return true; }
    }
    if (wantPositionTicket) {
      const dPos = idOf(d, ["position_id", "positionId", "position"]);
      if (dPos && dPos === wantPositionTicket) { dealMatchMode = "ticket"; return true; }
    }
    const dSym = String(d?.symbol ?? "");
    const candSym = input.brokerSymbol ?? wantSym;
    if (!symEq(dSym, candSym)) return false;
    if (mt5TypeToSide(d?.type) !== wantSide) return false;
    const vol = Number(d?.volume);
    if (!Number.isFinite(vol) || !volEq(vol, wantVol)) return false;
    if (!withinTime(d?.time)) return false;
    dealMatchMode = symMatchMode(candSym, dSym);
    return true;
  });

  // (C) Pending orders — ID first, then fallback.
  const matchedPendingOrder = pendingOrders.find((o: any) => {
    const oId = idOf(o, ["ticket", "id", "orderId"]);
    if (wantOrderId && oId && oId === wantOrderId) { pendingOrderMatchMode = "order_id"; return true; }
    if (wantRequestId) {
      const oReq = idOf(o, ["requestId", "clientOrderId", "request_id"]);
      if (oReq && oReq === wantRequestId) { pendingOrderMatchMode = "request_id"; return true; }
    }
    const oSym = String(o?.symbol ?? "");
    const candSym = input.brokerSymbol ?? wantSym;
    if (!symEq(oSym, candSym)) return false;
    if (mt5TypeToSide(o?.type) !== wantSide) return false;
    if (!volEq(Number(o?.volume_current ?? o?.volume_initial ?? 0), wantVol)) return false;
    if (!withinTime(o?.time_setup)) return false;
    pendingOrderMatchMode = symMatchMode(candSym, oSym);
    return true;
  });

  // (D) History orders — ID first, then fallback.
  const matchedHistoryOrder = historyOrders.find((o: any) => {
    const oId = idOf(o, ["ticket", "id", "orderId"]);
    if (wantOrderId && oId && oId === wantOrderId) { historyOrderMatchMode = "order_id"; return true; }
    if (wantRequestId) {
      const oReq = idOf(o, ["requestId", "clientOrderId", "request_id"]);
      if (oReq && oReq === wantRequestId) { historyOrderMatchMode = "request_id"; return true; }
    }
    const oSym = String(o?.symbol ?? "");
    const candSym = input.brokerSymbol ?? wantSym;
    if (!symEq(oSym, candSym)) return false;
    if (mt5TypeToSide(o?.type) !== wantSide) return false;
    if (!volEq(Number(o?.volume_initial ?? o?.volume_current ?? 0), wantVol)) return false;
    if (!withinTime(o?.time_setup)) return false;
    historyOrderMatchMode = symMatchMode(candSym, oSym);
    return true;
  });

  // Detect if any history order represents a rejection (state >= 4 typically).
  const rejectedHistoryOrder = matchedHistoryOrder && (() => {
    const state = Number((matchedHistoryOrder as any).state);
    // MT5 ORDER_STATE: 0 STARTED, 1 PLACED, 2 CANCELED, 3 PARTIAL, 4 FILLED, 5 REJECTED, 6 EXPIRED
    return state === 2 || state === 5 || state === 6;
  })();

  // ── Decision ────────────────────────────────────────────────────────────
  let result: {
    status: string;
    mt5Confirmed: boolean;
    explanation?: string;
    confirmedTicket?: string | null;
    confirmedEntryPrice?: number | null;
    confirmedVolume?: number | null;
  };
  let auditStatus: string;
  let auditClassification: string;

  if (matchedPosition) {
    const ticket = matchedPosition.ticket ?? matchedPosition.identifier ?? null;
    const rawEntry =
      matchedPosition?.entry_price ??
      matchedPosition?.price_open ??
      matchedPosition?.priceOpen ??
      matchedPosition?.openPrice ??
      matchedPosition?.open_price ??
      matchedPosition?.price ??
      matchedPosition?.entry ??
      null;
    const entryNum = rawEntry == null ? null : Number(rawEntry);
    result = {
      status: "position_confirmed",
      mt5Confirmed: true,
      confirmedTicket: ticket != null ? String(ticket) : null,
      confirmedEntryPrice:
        entryNum != null && Number.isFinite(entryNum) && entryNum !== 0 ? entryNum : null,
      confirmedVolume: Number(matchedPosition?.volume ?? 0) || null,
    };
    auditStatus = "position_confirmed";
    auditClassification = "placed_confirmed";
  } else if (matchedDeal) {
    result = {
      status: "deal_found_no_open_position",
      mt5Confirmed: false,
      explanation:
        "Deal found but no open position exists. It may have opened and closed immediately or netted.",
    };
    auditStatus = "deal_found_no_position";
    auditClassification = "execution_reconciled";
  } else if (matchedPendingOrder) {
    result = {
      status: "pending_order_placed",
      mt5Confirmed: false,
      explanation: "Pending order placed in MT5. Awaiting trigger/fill.",
    };
    auditStatus = "pending_order_placed";
    auditClassification = "pending_order";
  } else if (rejectedHistoryOrder) {
    result = {
      status: "order_rejected",
      mt5Confirmed: false,
      explanation: "Order was found in MT5 history with a rejected/canceled/expired state.",
    };
    auditStatus = "order_rejected";
    auditClassification = "execution_reconciled";
  } else if (matchedHistoryOrder) {
    result = {
      status: "order_found_not_filled",
      mt5Confirmed: false,
      explanation: "Order exists in MT5 history but no matching fill/deal was found.",
    };
    auditStatus = "order_found_not_filled";
    auditClassification = "execution_reconciled";
  } else if (rateLimitHit) {
    const endpoint = rateLimitedEntries[0]?.[0] ?? "unknown";
    result = {
      status: "confirmation_delayed_rate_limited",
      mt5Confirmed: false,
      explanation:
        "Broker accepted the order. MT5 confirmation is delayed due to API rate limits. We will keep checking.",
    };
    auditStatus = "confirmation_delayed_rate_limited";
    auditClassification = "confirmation_delayed_rate_limited";
    (result as any).endpointRateLimited = endpoint;
  } else {
    result = {
      status: "unconfirmed_after_reconciliation",
      mt5Confirmed: false,
      explanation:
        "All available MT5 sources were checked and no matching position/order/deal was found.",
    };
    auditStatus = "unconfirmed_after_reconciliation";
    auditClassification = "unconfirmed_after_reconciliation";
  }

  // Confirmation lifecycle status — explicit for the client UI.
  const confirmationStatus =
    result.mt5Confirmed
      ? "confirmed"
      : result.status === "pending_order_placed"
        ? "pending_order"
        : result.status === "confirmation_delayed_rate_limited"
          ? "delayed_rate_limited"
        : result.status === "order_rejected"
          ? "rejected"
          : "not_found";
  (result as any).confirmationStatus = confirmationStatus;
  (result as any).brokerAccepted =
    Number(input?.brokerRetcode) === 10008 ||
    Number(input?.brokerRetcode) === 10009 ||
    input?.rawExecutionResponse?.success === true ||
    input?.rawExecutionResponse?.liveOrderSent === true ||
    matchedPosition || matchedDeal || matchedPendingOrder || matchedHistoryOrder
      ? true
      : false;

  // ── Named audit fields (v1.2.0) ─────────────────────────────────────────
  // Prefer matched MT5 record retcode > broker response retcode > input.
  const effectiveRetcode =
    (matchedHistoryOrder as any)?.retcode ??
    (matchedPosition as any)?.retcode ??
    input?.rawExecutionResponse?.retcode ??
    input?.brokerRetcode ??
    null;
  const { retcodeName, retcodeDescription } = lookupRetcode(effectiveRetcode);
  const reconciliationAttempts =
    Number.isFinite(Number((input as any)?.reconciliationAttempts)) &&
    Number((input as any)?.reconciliationAttempts) > 0
      ? Number((input as any)?.reconciliationAttempts)
      : 1;
  const lastReconciliationAt = new Date().toISOString();

  const fullPayload = {
    version: VERSION,
    ...result,
    retcode: effectiveRetcode,
    retcodeName,
    retcodeDescription,
    reconciliationAttempts,
    lastReconciliationAt,
    sourcesChecked,
    checked: {
      ...checkedCounts,
      positions: {
        checked: sourcesChecked.positions, skippedReason: sourcesSkipped.positions,
        ok: posRes.ok, status: posRes.status, count: positions.length,
        matchFound: !!matchedPosition,
      },
      pendingOrders: {
        checked: sourcesChecked.pending, skippedReason: sourcesSkipped.pending,
        ok: ordersRes.ok, status: ordersRes.status, count: pendingOrders.length,
        matchFound: !!matchedPendingOrder,
      },
      historyOrders: {
        checked: sourcesChecked.orders, skippedReason: sourcesSkipped.orders,
        ok: histOrdersRes.ok, status: histOrdersRes.status, count: historyOrders.length,
        matchFound: !!matchedHistoryOrder,
      },
      historyDeals: {
        checked: sourcesChecked.deals, skippedReason: sourcesSkipped.deals,
        ok: histDealsRes.ok, status: histDealsRes.status, count: historyDeals.length,
        matchFound: !!matchedDeal,
      },
      window: { from: windowFrom, to: windowTo },
    },
    sourcesSkipped,
    rateLimitHit,
    retryAfter,
    nextReconcileAt,
    upstreamStatus: rateLimitHit ? "rate_limited" : "ok",
    endpointRateLimited: rateLimitedEntries[0]?.[0] ?? null,
    matchingMode: matchedPosition ? "positionTicket" : matchedDeal ? "dealId" : matchedPendingOrder ? "orderId" : matchedHistoryOrder ? "orderId" : targetLookupMode,
    targetLookupMode,
    confirmationCoordinator: {
      activeJobsCount: reconcileInFlight.size,
      currentTradeId: input.tradeId ?? null,
      coordinatorStatus: rateLimitHit ? "confirmation_delayed_rate_limited" : "checking",
      nextCheckAt: nextReconcileAt,
      accountCooldownUntil: retryAfter ? nextReconcileAt : null,
      requestsAvoidedDuringCooldown,
      lastEndpointCalled: calls[calls.length - 1]?.endpoint ?? null,
      lastHttpStatus: calls[calls.length - 1]?.status ?? null,
      targetLookupMode,
      cachedStateUsed: false,
      endpointPlan,
      upstreamCalls: calls,
    },
    matchedTicket: matchedPosition ? String(matchedPosition.ticket ?? matchedPosition.id ?? "") : null,
    matchedDealId: matchedDeal ? String(matchedDeal.ticket ?? matchedDeal.id ?? matchedDeal.dealId ?? "") : null,
    matchedOrderId: (matchedPendingOrder || matchedHistoryOrder)
      ? String((matchedPendingOrder ?? matchedHistoryOrder).ticket ?? (matchedPendingOrder ?? matchedHistoryOrder).id ?? "")
      : null,
    account: {
      account_id: mapping.localRowId,
      mt5_login: mapping.login,
      server: mapping.server,
      trading_layer_account_id: accountId,
      trading_layer_trader_id: traderId,
      metaapi_account_id: accountId,
      local_row_id: mapping.localRowId,
      mapping_status: mapping.status,
      trader_status: null,
    },
    request: {
      tradeId: input.tradeId ?? null,
      symbol: wantSym,
      side: wantSide,
      volume: wantVol,
      requestedPrice: input.requestedPrice ?? null,
      clientClickAt: input.clientClickAt ?? null,
      brokerRetcode: input.brokerRetcode ?? null,
      brokerMessage: input.brokerMessage ?? null,
    },
    samples: {
      positions: positions.slice(0, 5),
      pendingOrders: pendingOrders.slice(0, 5),
      historyOrders: historyOrders.slice(0, 5),
      historyDeals: historyDeals.slice(0, 5),
    },
    rawExecutionResponse: input.rawExecutionResponse ?? null,
  };

  // ── Update the latest execution_audit_events row ────────────────────────
  try {
    let q = supabase
      .from("execution_audit_events")
      .select("id, raw")
      .eq("user_id", userId)
      .eq("symbol", wantSym);
    if (input.tradeId) q = q.eq("trade_id", input.tradeId);
    const { data: rows } = await q
      .order("created_at", { ascending: false })
      .limit(1);

    if (rows && rows.length > 0) {
      const rowId = rows[0].id;
      const prevRaw = (rows[0] as any).raw ?? {};
      await supabase
        .from("execution_audit_events")
        .update({
          status: auditStatus,
          outcome: result.mt5Confirmed
            ? "success"
            : auditStatus === "confirmation_delayed_rate_limited"
              ? "pending"
              : auditStatus === "order_rejected"
                ? "rejected"
                : "unconfirmed",
          retcode: effectiveRetcode != null && Number.isFinite(Number(effectiveRetcode)) ? Number(effectiveRetcode) : null,
          ticket: result.confirmedTicket ?? null,
          executed_price: result.confirmedEntryPrice ?? null,
          broker_message: matchedPosition
            ? `Position confirmed in MT5. Ticket: ${result.confirmedTicket}`
            : (result.explanation ?? input.brokerMessage ?? null),
          raw: {
            ...prevRaw,
            classification: auditClassification,
            mt5Confirmed: result.mt5Confirmed,
            reconciliation: fullPayload,
          },
        })
        .eq("id", rowId)
        .eq("user_id", userId);
    }
  } catch {
    // Audit update is best-effort — never block the reconcile response.
  }

  return json(200, { ok: true, ...fullPayload });
});
