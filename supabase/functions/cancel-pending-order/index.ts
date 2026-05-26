// Cancel Pending Order — admin live test cancellation of a pending MT5 order.
// Backend-only path; performs execution-mode gate + risk kill-switch check,
// sends ORDER_CANCEL to Trading Layer, and writes an execution_audit_events row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadRiskSettings } from "../_shared/risk.ts";
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

const VERSION = "CANCEL_PENDING_ORDER_V1_2026_05_22";
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

  const orderId = payload?.orderId != null ? String(payload.orderId) : null;
  const symbol = payload?.symbol ? String(payload.symbol).toUpperCase() : null;
  const suppliedBrokerSymbol = payload?.brokerSymbol ? String(payload.brokerSymbol) : null;
  if (!orderId) return json({ success: false, version: VERSION, error: "orderId is required" }, 400);
  if (!suppliedBrokerSymbol && !symbol) {
    return json({
      success: false,
      version: VERSION,
      error: "BROKER_SYMBOL_REQUIRED_FOR_CANCEL",
      message: "Broker execution symbol is missing for this legacy order. Refresh from MT5 before cancellation.",
    }, 400);
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

  const gate = await assertLiveExecutionAllowed(supabase, user.id, { traderId: mapping.traderId, login: mapping.login });
  if (!gate.allowed) {
    return json({
      success: false, version: VERSION,
      error: gate.code || LIVE_EXEC_DISABLED_CODE,
      reason: gate.reason, executionMode: gate.mode,
    }, 403);
  }

  try {
    const s = await loadRiskSettings(supabase, user.id);
    if (s.kill_switch_enabled) return json({ success: false, version: VERSION, error: "Trading disabled by kill switch.", rule: "kill_switch" }, 403);
  } catch { /* ignore */ }

  // Broker-symbol gate — use stored brokerSymbol if provided, else look up via canonical symbol.
  const eligible = await resolveEligibleBrokerSymbol(supabase, {
    userId: user.id,
    traderId: accountId,
    accountId: mapping.tradingLayerAccountId,
    requestedDisplaySymbol: symbol,
    suppliedBrokerSymbol,
    operationType: "cancel_pending",
  });
  if (!eligible.ok) {
    return json(brokerSymbolGateResponse(VERSION, eligible, { orderId }), 200);
  }
  const brokerSymbol = eligible.brokerSymbol as string;

  // PART 1 — Fresh trade_mode refresh (≤30s execution-permission gate).
  const fresh = await refreshTradeModeFromTradingLayer(supabase, {
    traderId: accountId, accountId: mapping.tradingLayerAccountId, brokerSymbol, login: mapping.login, server: mapping.server,
  });
  if (!fresh.ok) {
    return json(freshTradeModeGateResponse(VERSION, fresh, { orderId }), 200);
  }


  const idempotencyKey = `cancel-${orderId}-${Date.now()}`;
  const tlPayload = {
    actionType: "ORDER_CANCEL",
    orderId: Number(orderId) || orderId,
    symbol: brokerSymbol,
  };

  const startedAt = Date.now();
  let httpStatus = 0; let res: any = null; let networkError: string | null = null;
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
    const t = await r.text();
    try { res = JSON.parse(t); } catch { res = { rawText: t }; }
  } catch (e) { networkError = e instanceof Error ? e.message : String(e); }
  const latencyMs = Date.now() - startedAt;

  const retcode = res?.retcode != null ? Number(res.retcode) : null;
  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const cancelled = httpOk && (res?.success === true || retcode === 10009 || retcode === 10008);
  const brokerMessage = res?.brokerMessage ?? res?.message ?? res?.error ?? res?.retcodeDescription ?? null;

  // Broker-accepted cancel is NOT a confirmed cancel — client must verify
  // by checking that the pending order no longer appears.
  const status = cancelled ? "cancel_broker_accepted_pending_confirmation"
    : (httpStatus === 429 ? "confirmation_delayed_rate_limited" : "cancel_rejected");

  try {
    await supabase.from("execution_audit_events").insert({
      user_id: user.id,
      trade_id: `cancel-${orderId}`,
      symbol,
      side: "buy",
      volume: 0,
      status,
      outcome: cancelled ? "broker_accepted_pending_confirmation" : (httpStatus === 429 ? "rate_limited" : "failed"),
      latency_ms: latencyMs,
      broker_message: brokerMessage,
      retcode,
      ticket: orderId,
      raw: {
        classification: "cancel_pending", version: VERSION,
        tradingLayerStatus: httpStatus, request: tlPayload, response: res, networkError,
        displaySymbol: symbol, brokerSymbol,
        symbolMappingSource: eligible.symbolMappingSource,
        symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
      },
    });
  } catch { /* ignore */ }

  return json({
    success: cancelled,
    version: VERSION,
    classification: "cancel_pending",
    status,
    orderId,
    displaySymbol: symbol,
    brokerSymbol,
    symbol: brokerSymbol,
    symbolMappingSource: eligible.symbolMappingSource,
    symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
    retcode,
    brokerMessage,
    latencyMs,
    tradingLayerStatus: httpStatus,
    metaapi_account_id: accountId,
    error: cancelled ? null : (networkError || brokerMessage || "Cancel failed"),
  });
});

