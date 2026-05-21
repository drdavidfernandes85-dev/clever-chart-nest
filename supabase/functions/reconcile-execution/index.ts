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

const VERSION = "reconcile-execution@1.3.0";

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

async function tlFetch(
  path: string,
  qs: Record<string, string | number | undefined>,
  apiKey: string,
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
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
    return { ok: res.ok, status: res.status, data: body };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : String(e) };
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

  // ── Load the connected MT5 account ──────────────────────────────────────
  const { data: account, error: accErr } = await supabase
    .from("user_mt_accounts")
    .select("id, login, server_name, status, metaapi_account_id, broker_name")
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accErr) {
    return json(500, { ok: false, version: VERSION, error: accErr.message });
  }
  if (!account?.metaapi_account_id) {
    return json(200, {
      ok: false,
      version: VERSION,
      status: "execution_unconfirmed",
      mt5Confirmed: false,
      explanation: "No connected MT5 account found for this user.",
    });
  }

  const accountId = String(account.metaapi_account_id);
  const traderId = accountId; // Same value per existing get-live-account convention.

  // Date window: ±10 minutes around the click (defaults to "now - 10m").
  const clickMs = input.clientClickAt ? Date.parse(input.clientClickAt) : Date.now();
  const windowFrom = new Date(clickMs - 10 * 60_000).toISOString();
  const windowTo = new Date(Date.now() + 60_000).toISOString();

  // ── Parallel fetches against Trading Layer ──────────────────────────────
  const [traderRes, posRes, ordersRes, histOrdersRes, histDealsRes] = await Promise.all([
    tlFetch(`/traders/${encodeURIComponent(traderId)}`, {}, TL_KEY),
    tlFetch(`/accounts/${encodeURIComponent(accountId)}/positions`, {
      symbol: wantSym,
      limit: 100,
    }, TL_KEY),
    tlFetch(`/accounts/${encodeURIComponent(accountId)}/orders`, {
      symbol: wantSym,
      limit: 100,
    }, TL_KEY),
    tlFetch(`/accounts/${encodeURIComponent(accountId)}/history/orders`, {
      symbol: wantSym,
      dateFrom: windowFrom,
      dateTo: windowTo,
      limit: 100,
      sort: "time_setup",
      order: "desc",
    }, TL_KEY),
    tlFetch(`/accounts/${encodeURIComponent(accountId)}/history/deals`, {
      symbol: wantSym,
      dateFrom: windowFrom,
      dateTo: windowTo,
      limit: 100,
      sort: "time",
      order: "desc",
    }, TL_KEY),
  ]);

  const positions: any[] = Array.isArray(posRes.data?.data) ? posRes.data.data : [];
  const pendingOrders: any[] = Array.isArray(ordersRes.data?.data) ? ordersRes.data.data : [];
  const historyOrders: any[] = Array.isArray(histOrdersRes.data?.data) ? histOrdersRes.data.data : [];
  const historyDeals: any[] = Array.isArray(histDealsRes.data?.data) ? histDealsRes.data.data : [];

  // ── Matching ────────────────────────────────────────────────────────────
  const clickSec = Math.floor(clickMs / 1000);
  const withinTime = (t: any) => {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return true; // unknown → don't reject on time
    return Math.abs(n - clickSec) <= 600; // 10 minute window
  };

  // (A) open positions
  const matchedPosition = positions.find((p: any) => {
    if (String(p?.symbol || "").toUpperCase() !== wantSym) return false;
    if (mt5TypeToSide(p?.type) !== wantSide) return false;
    if (!volEq(Number(p?.volume), wantVol)) return false;
    if (!withinTime(p?.time)) return false;
    return true;
  });

  // (B) deals — typically two per market open/close. We want an IN deal (entry=0).
  const matchedDeal = historyDeals.find((d: any) => {
    if (String(d?.symbol || "").toUpperCase() !== wantSym) return false;
    if (mt5TypeToSide(d?.type) !== wantSide) return false;
    const vol = Number(d?.volume);
    if (!Number.isFinite(vol) || !volEq(vol, wantVol)) return false;
    if (!withinTime(d?.time)) return false;
    return true;
  });

  // (C) orders — first pending, then history (rejected/canceled/filled).
  const matchedPendingOrder = pendingOrders.find((o: any) => {
    if (String(o?.symbol || "").toUpperCase() !== wantSym) return false;
    if (mt5TypeToSide(o?.type) !== wantSide) return false;
    if (!volEq(Number(o?.volume_current ?? o?.volume_initial ?? 0), wantVol)) return false;
    if (!withinTime(o?.time_setup)) return false;
    return true;
  });

  const matchedHistoryOrder = historyOrders.find((o: any) => {
    if (String(o?.symbol || "").toUpperCase() !== wantSym) return false;
    if (mt5TypeToSide(o?.type) !== wantSide) return false;
    if (!volEq(Number(o?.volume_initial ?? o?.volume_current ?? 0), wantVol)) return false;
    if (!withinTime(o?.time_setup)) return false;
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
  } else {
    result = {
      status: "execution_unconfirmed",
      mt5Confirmed: false,
      explanation:
        "Broker accepted request but no matching MT5 position/order/deal was found yet.",
    };
    auditStatus = "execution_unconfirmed";
    auditClassification = "placed_unconfirmed";
  }

  // Confirmation lifecycle status — explicit for the client UI.
  const confirmationStatus =
    result.mt5Confirmed
      ? "confirmed"
      : result.status === "pending_order_placed"
        ? "pending_order"
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
    account: {
      account_id: account.id,
      mt5_login: account.login,
      server: account.server_name,
      trading_layer_account_id: accountId,
      trading_layer_trader_id: traderId,
      trader_status: traderRes.ok ? (traderRes.data?.data?.status ?? null) : null,
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
    checked: {
      positions: {
        ok: posRes.ok, status: posRes.status, count: positions.length,
        matchFound: !!matchedPosition,
      },
      pendingOrders: {
        ok: ordersRes.ok, status: ordersRes.status, count: pendingOrders.length,
        matchFound: !!matchedPendingOrder,
      },
      historyOrders: {
        ok: histOrdersRes.ok, status: histOrdersRes.status, count: historyOrders.length,
        matchFound: !!matchedHistoryOrder,
      },
      historyDeals: {
        ok: histDealsRes.ok, status: histDealsRes.status, count: historyDeals.length,
        matchFound: !!matchedDeal,
      },
      window: { from: windowFrom, to: windowTo },
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
