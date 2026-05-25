// Submit Pending Order — Buy/Sell Limit/Stop (admin live test only).
// Sends a real MT5 pending order to Trading Layer with side-of-market validation,
// risk + execution-mode gates, and writes an execution_audit_events row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  loadRiskSettings,
  buildRiskBlock,
  auditRiskBlock,
} from "../_shared/risk.ts";
import {
  resolveActiveMtMapping,
  STALE_MAPPING_ERROR_CODE,
  STALE_MAPPING_USER_MESSAGE,
} from "../_shared/mtMapping.ts";
import {
  assertLiveExecutionAllowed,
  LIVE_EXEC_DISABLED_CODE,
} from "../_shared/executionMode.ts";
import {
  resolveEligibleBrokerSymbol,
  brokerSymbolGateResponse,
  refreshTradeModeFromTradingLayer,
  freshTradeModeGateResponse,
} from "../_shared/brokerSymbol.ts";

const VERSION = "SUBMIT_PENDING_ORDER_V1_2026_05_22";
const BASE_URL = "https://api.trading-layer.com";
const MAX_TEST_VOLUME = 0.01;

const PENDING_TYPES = ["buy_limit", "sell_limit", "buy_stop", "sell_stop"] as const;
type PendingType = typeof PENDING_TYPES[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const TL_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!TL_KEY) return json({ success: false, version: VERSION, error: "Missing TRADING_LAYER_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, version: VERSION, error: "Missing Authorization header" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ success: false, version: VERSION, error: "Unauthorized" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ success: false, version: VERSION, error: "Invalid JSON body" }, 400); }

  const symbol = payload?.symbol ? String(payload.symbol).toUpperCase() : null;
  const pendingType = String(payload?.pendingType || "").toLowerCase() as PendingType;
  const volume = Number(payload?.volume);
  const entryPrice = Number(payload?.entryPrice);
  const currentBid = Number(payload?.currentBid);
  const currentAsk = Number(payload?.currentAsk);
  const stopLoss = payload?.stopLoss == null || payload.stopLoss === "" ? null : Number(payload.stopLoss);
  const takeProfit = payload?.takeProfit == null || payload.takeProfit === "" ? null : Number(payload.takeProfit);
  const tradeId = typeof payload?.tradeId === "string" && payload.tradeId ? payload.tradeId : `pending-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  if (!symbol || !PENDING_TYPES.includes(pendingType) || !Number.isFinite(volume) || volume <= 0 || !Number.isFinite(entryPrice)) {
    return json({ success: false, version: VERSION, error: "symbol, pendingType (buy_limit|sell_limit|buy_stop|sell_stop), volume and entryPrice are required" }, 400);
  }
  if (volume > MAX_TEST_VOLUME) {
    return json({ success: false, version: VERSION, error: `Pending blocked: volume ${volume} exceeds test cap ${MAX_TEST_VOLUME}` }, 400);
  }

  // Side-of-market validation against fresh tick (if provided).
  if (Number.isFinite(currentBid) && Number.isFinite(currentAsk) && currentBid > 0 && currentAsk > 0) {
    const reasons: string[] = [];
    if (pendingType === "buy_limit" && !(entryPrice < currentAsk)) reasons.push("Buy Limit entry must be below current ask.");
    if (pendingType === "sell_limit" && !(entryPrice > currentBid)) reasons.push("Sell Limit entry must be above current bid.");
    if (pendingType === "buy_stop" && !(entryPrice > currentAsk)) reasons.push("Buy Stop entry must be above current ask.");
    if (pendingType === "sell_stop" && !(entryPrice < currentBid)) reasons.push("Sell Stop entry must be below current bid.");
    if (reasons.length) return json({ success: false, version: VERSION, error: reasons[0], reasons }, 400);
  }

  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status === "missing") return json({ success: false, version: VERSION, error: "No connected MT5 account found" }, 404);
  if (mapping.status === "stale" || !mapping.traderId) {
    return json({
      success: false, version: VERSION,
      error: STALE_MAPPING_ERROR_CODE, message: STALE_MAPPING_USER_MESSAGE,
      mappingStatus: mapping.status, localRowId: mapping.localRowId,
    }, 409);
  }
  const accountId = mapping.traderId;

  // Execution-mode gate (admin allowlist).
  const gate = await assertLiveExecutionAllowed(supabase, user.id, { traderId: mapping.traderId, login: mapping.login });
  if (!gate.allowed) {
    return json({
      success: false, version: VERSION,
      error: gate.code || LIVE_EXEC_DISABLED_CODE,
      reason: gate.reason, executionMode: gate.mode,
    }, 403);
  }

  // Admin live test limits: pending orders gate.
  try {
    const { data: limits } = await supabase.from("admin_live_test_limits").select("pending_orders_enabled,max_order_volume").limit(1).maybeSingle();
    if (limits && limits.pending_orders_enabled === false) {
      return json({
        success: false, version: VERSION,
        error: "PENDING_ORDERS_DISABLED_UNTIL_MARKET_VERIFIED",
        reason: "Pending orders are disabled until at least one market open/close has been confirmed.",
      }, 403);
    }
    if (limits && Number.isFinite(Number(limits.max_order_volume)) && volume > Number(limits.max_order_volume)) {
      return json({ success: false, version: VERSION, error: `Volume ${volume} exceeds current admin test cap ${limits.max_order_volume}.` }, 400);
    }
  } catch { /* ignore — fall through */ }

  // Risk: kill switch + live trading enabled.
  try {
    const settings = await loadRiskSettings(supabase, user.id);
    let breach: { reason: string; rule: string } | null = null;
    if (settings.kill_switch_enabled) breach = { reason: "Trading disabled by kill switch.", rule: "kill_switch" };
    else if (!settings.live_trading_enabled) breach = { reason: "Live trading is disabled.", rule: "live_trading_disabled" };
    if (breach) {
      const blockBody = buildRiskBlock(VERSION, { reason: breach.reason, rule: breach.rule, settings }, { tradeId, symbol, pendingType, volume });
      await auditRiskBlock(supabase, user.id, {
        tradeId, symbol, side: pendingType.startsWith("buy") ? "buy" : "sell", volume,
        reason: breach.reason, rule: breach.rule, response: blockBody,
      });
      return json(blockBody, 200);
    }
  } catch { /* fall through */ }

  // Broker-symbol + symbol trade_mode gate — fail closed if unresolved/stale/blocked.
  const eligible = await resolveEligibleBrokerSymbol(supabase, {
    userId: user.id,
    traderId: accountId,
    requestedDisplaySymbol: symbol,
    suppliedBrokerSymbol: payload?.brokerSymbol ?? null,
    operationType: "pending_order",
  });
  if (!eligible.ok) {
    return json(brokerSymbolGateResponse(VERSION, eligible, { tradeId, pendingType, volume, entryPrice }), 200);
  }
  const brokerSymbol = eligible.brokerSymbol as string;

  // PART 1 — Fresh trade_mode refresh (≤30s execution-permission gate).
  const fresh = await refreshTradeModeFromTradingLayer(supabase, {
    traderId: accountId, brokerSymbol, login: mapping.login, server: mapping.server,
  });
  if (!fresh.ok) {
    return json(freshTradeModeGateResponse(VERSION, fresh, { tradeId, pendingType, volume, entryPrice }), 200);
  }


  // Trading Layer payload — generic shape; backend maps to MT5 pending order types.
  // 2 = ORDER_TYPE_BUY_LIMIT, 3 = SELL_LIMIT, 4 = BUY_STOP, 5 = SELL_STOP (MT5).
  const tlTypeNumeric =
    pendingType === "buy_limit" ? 2 :
    pendingType === "sell_limit" ? 3 :
    pendingType === "buy_stop" ? 4 : 5;
  const idempotencyKey = `pending-${tradeId}`;
  const tlPayload: Record<string, unknown> = {
    actionType: "ORDER_TYPE_" + pendingType.toUpperCase(),
    type: tlTypeNumeric,
    symbol: brokerSymbol,
    volume,
    openPrice: entryPrice,
    price: entryPrice,
  };
  if (stopLoss != null) tlPayload.stopLoss = stopLoss;
  if (takeProfit != null) tlPayload.takeProfit = takeProfit;

  const startedAt = Date.now();
  let httpStatus = 0;
  let res: any = null;
  let networkError: string | null = null;
  try {
    const r = await fetch(`${BASE_URL}/api/v1/accounts/${accountId}/trades/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TL_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(tlPayload),
    });
    httpStatus = r.status;
    const text = await r.text();
    try { res = JSON.parse(text); } catch { res = { rawText: text }; }
  } catch (e) {
    networkError = e instanceof Error ? e.message : String(e);
  }
  const latencyMs = Date.now() - startedAt;

  const retcode = res?.retcode != null ? Number(res.retcode) : null;
  const brokerMessage = res?.brokerMessage ?? res?.message ?? res?.error ?? res?.retcodeDescription ?? null;
  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const placed = httpOk && (res?.success === true || retcode === 10008 || retcode === 10009);
  const orderId = res?.orderId ?? res?.order ?? res?.order_id ?? res?.ticket ?? null;
  const requestId = res?.requestId ?? res?.request_id ?? null;

  const status = placed ? "pending_order_placed" : (httpStatus === 429 ? "rate_limited" : "pending_order_failed");
  const outcome = placed ? "success" : (httpStatus === 429 ? "rate_limited" : "failed");

  try {
    await supabase.from("execution_audit_events").insert({
      user_id: user.id,
      trade_id: tradeId,
      symbol,
      side: pendingType.startsWith("buy") ? "buy" : "sell",
      volume,
      status,
      outcome,
      requested_price: entryPrice,
      executed_price: null,
      latency_ms: latencyMs,
      broker_message: brokerMessage,
      retcode,
      reason: outcome !== "success" ? (networkError || brokerMessage) : null,
      ticket: orderId != null ? String(orderId) : null,
      raw: {
        classification: "pending_order",
        version: VERSION,
        pendingType,
        tradingLayerStatus: httpStatus,
        request: tlPayload,
        response: res,
        networkError,
        displaySymbol: symbol,
        brokerSymbol,
        symbolMappingSource: eligible.symbolMappingSource,
        symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
        symbolTradeMode: eligible.symbolTradeMode,
      },
    });
  } catch { /* ignore audit failures */ }

  return json({
    success: placed,
    version: VERSION,
    classification: "pending_order",
    status,
    tradeId,
    orderId,
    requestId,
    pendingType,
    displaySymbol: symbol,
    brokerSymbol,
    symbol: brokerSymbol,
    symbolMappingSource: eligible.symbolMappingSource,
    symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
    volume,
    entryPrice,
    stopLoss,
    takeProfit,
    retcode,
    brokerMessage,
    latencyMs,
    tradingLayerStatus: httpStatus,
    metaapi_account_id: accountId,
    error: placed ? null : (networkError || brokerMessage || "Pending order placement failed"),
  });
});
