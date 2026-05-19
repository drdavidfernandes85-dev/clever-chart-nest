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

const VERSION = "reconcile-execution@1.0.0";
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
    if (!eq(Number(p?.volume), wantVol)) return false;
    if (!withinTime(p?.time)) return false;
    return true;
  });

  // (B) deals — typically two per market open/close. We want an IN deal (entry=0).
  const matchedDeal = historyDeals.find((d: any) => {
    if (String(d?.symbol || "").toUpperCase() !== wantSym) return false;
    if (mt5TypeToSide(d?.type) !== wantSide) return false;
    const vol = Number(d?.volume);
    if (!Number.isFinite(vol) || !eq(vol, wantVol)) return false;
    if (!withinTime(d?.time)) return false;
    return true;
  });

  // (C) orders — first pending, then history (rejected/canceled/filled).
  const matchedPendingOrder = pendingOrders.find((o: any) => {
    if (String(o?.symbol || "").toUpperCase() !== wantSym) return false;
    if (mt5TypeToSide(o?.type) !== wantSide) return false;
    if (!eq(Number(o?.volume_current ?? o?.volume_initial ?? 0), wantVol)) return false;
    if (!withinTime(o?.time_setup)) return false;
    return true;
  });

  const matchedHistoryOrder = historyOrders.find((o: any) => {
    if (String(o?.symbol || "").toUpperCase() !== wantSym) return false;
    if (mt5TypeToSide(o?.type) !== wantSide) return false;
    if (!eq(Number(o?.volume_initial ?? o?.volume_current ?? 0), wantVol)) return false;
    if (!withinTime(o?.time_setup)) return false;
    return true;
  });

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
    result = {
      status: "position_confirmed",
      mt5Confirmed: true,
      confirmedTicket: ticket != null ? String(ticket) : null,
      confirmedEntryPrice: Number(matchedPosition?.price_open ?? 0) || null,
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
  } else if (matchedPendingOrder || matchedHistoryOrder) {
    result = {
      status: "order_found_not_filled",
      mt5Confirmed: false,
      explanation: "Order exists but no fill/deal was found.",
    };
    auditStatus = "order_found_not_filled";
    auditClassification = "execution_reconciled";
  } else {
    result = {
      status: "execution_unconfirmed",
      mt5Confirmed: false,
      explanation:
        "Broker accepted request but no matching MT5 position/order/deal was found.",
    };
    auditStatus = "execution_unconfirmed";
    auditClassification = "placed_unconfirmed";
  }

  const fullPayload = {
    version: VERSION,
    ...result,
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
