// Modify Position Protection — update SL / TP on an open MT5 position.
// HISTORICAL AUDIT GAP: pre-2026-06-11 gate rejections are unrecorded. From
// 2026-06-11 onward, every pre-TL gate block writes a *_blocked_* row to
// execution_audit_events via the shared auditGateBlock() helper.
// Does NOT call execute-trade or place-order. Sends only SL/TP changes to
// Trading Layer and logs the result to execution_audit_events.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadRiskSettings, buildRiskBlock, auditRiskBlock } from "../_shared/risk.ts";
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
import { resolveBrokerSymbolWithSelfHeal } from "../_shared/brokerSymbolSelfHeal.ts";
import {
  assertCanaryCapabilityDisabled,
  canaryGuardResponseBody,
} from "../_shared/canaryPolicy.ts";
import { auditGateBlock } from "../_shared/auditGateBlock.ts";


const VERSION = "MODIFY_POSITION_PROTECTION_RISK_V4_2026_06_11";
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!TRADING_LAYER_KEY) {
    return json({ success: false, version: VERSION, error: "Missing TRADING_LAYER_API_KEY" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, version: VERSION, error: "Missing Authorization header" }, 401);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json({ success: false, version: VERSION, error: "Unauthorized" }, 401);
  }

  // Limited Canary policy: SL/TP modification requires the policy capability switch.
  const canaryGuardModify = await assertCanaryCapabilityDisabled(supabase, "modify_protection");
  // Limited Canary policy: SL/TP modification requires the policy capability switch.
  const canaryGuardModify = await assertCanaryCapabilityDisabled(supabase, "modify_protection");
  if (!canaryGuardModify.allowed) {
    await auditGateBlock(supabase, { userId: user.id, action: "modify_protection", gate: "canary",
      reason: canaryGuardModify.reason || "canary_disabled", version: VERSION });
    return json(canaryGuardResponseBody(canaryGuardModify, VERSION), 403);
  }


  let payload: any;
  try { payload = await req.json(); } catch {
    await auditGateBlock(supabase, { userId: user.id, action: "modify_protection", gate: "bad_request",
      reason: "invalid_json_body", version: VERSION });
    return json({ success: false, version: VERSION, error: "Invalid JSON body" }, 400);
  }
  const ticket = payload?.ticket != null ? String(payload.ticket) : null;
  const symbol = payload?.symbol ? String(payload.symbol).toUpperCase() : null;
  const suppliedBrokerSymbol = payload?.brokerSymbol ? String(payload.brokerSymbol) : null;
  const side = payload?.side ? String(payload.side).toLowerCase() : null;
  const volume = Number(payload?.volume);
  const currentPrice = Number(payload?.currentPrice);
  const stopLossRaw = payload?.stopLoss;
  const takeProfitRaw = payload?.takeProfit;
  const stopLoss =
    stopLossRaw === null || stopLossRaw === "" || stopLossRaw === undefined
      ? null
      : Number(stopLossRaw);
  const takeProfit =
    takeProfitRaw === null || takeProfitRaw === "" || takeProfitRaw === undefined
      ? null
      : Number(takeProfitRaw);

  const safeSide: "buy" | "sell" | null = side === "buy" || side === "sell" ? side : null;
  const ab = (gate: string, reason: string, extra?: Record<string, unknown>) =>
    auditGateBlock(supabase, { userId: user.id, action: "modify_protection", gate, reason,
      ticket, symbol, side: safeSide, volume: Number.isFinite(volume) ? volume : 0,
      version: VERSION, extra });

  if (!ticket || !symbol || (side !== "buy" && side !== "sell")) {
    await ab("bad_request", "ticket_symbol_side_required");
    return json({ success: false, version: VERSION,
      error: "ticket, symbol and side (buy|sell) are required" }, 400);
  }
  if (stopLoss === null && takeProfit === null) {
    await ab("bad_request", "sl_or_tp_required");
    return json({ success: false, version: VERSION,
      error: "Provide at least one of stopLoss or takeProfit" }, 400);
  }
  if (stopLoss !== null && !Number.isFinite(stopLoss)) {
    await ab("bad_request", "sl_not_number");
    return json({ success: false, version: VERSION, error: "stopLoss must be a number" }, 400);
  }
  if (takeProfit !== null && !Number.isFinite(takeProfit)) {
    await ab("bad_request", "tp_not_number");
    return json({ success: false, version: VERSION, error: "takeProfit must be a number" }, 400);
  }
  if (Number.isFinite(currentPrice) && currentPrice > 0) {
    const sideError = (msg: string) => {
      return ab("bad_request", msg).then(() =>
        json({ success: false, version: VERSION, error: msg }, 400));
    };
    if (side === "buy") {
      if (stopLoss !== null && stopLoss >= currentPrice) return await sideError("For buy, SL must be below current price");
      if (takeProfit !== null && takeProfit <= currentPrice) return await sideError("For buy, TP must be above current price");
    } else {
      if (stopLoss !== null && stopLoss <= currentPrice) return await sideError("For sell, SL must be above current price");
      if (takeProfit !== null && takeProfit >= currentPrice) return await sideError("For sell, TP must be below current price");
    }
  }

  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status === "missing") {
    await ab("no_mapping", "no_connected_mt5");
    return json({ success: false, version: VERSION, error: "No connected MT5 account found" }, 404);
  }
  if (mapping.status === "stale" || !mapping.traderId) {
    await ab("stale_mapping", STALE_MAPPING_ERROR_CODE);
    return json({ success: false, version: VERSION,
      error: STALE_MAPPING_ERROR_CODE, message: STALE_MAPPING_USER_MESSAGE,
      mappingStatus: mapping.status, localRowId: mapping.localRowId }, 409);
  }
  const accountId = mapping.traderId;

  // ---------- Execution-mode allowlist (admin live testing gate) ----------
  {
    const gate = await assertLiveExecutionAllowed(supabase, user.id, {
      traderId: mapping.traderId, login: mapping.login,
    });
    if (!gate.allowed) {
      await ab("exec_mode", gate.reason || LIVE_EXEC_DISABLED_CODE, { executionMode: gate.mode });
      return json({ success: false, version: VERSION,
        error: gate.code || LIVE_EXEC_DISABLED_CODE,
        reason: gate.reason, executionMode: gate.mode }, 403);
    }
  }


  // Backend risk enforcement — already audited via auditRiskBlock; keep as-is.
  try {
    const settings = await loadRiskSettings(supabase, user.id);
    let breach: { reason: string; rule: string } | null = null;
    if (settings.kill_switch_enabled) breach = { reason: "Trading disabled by kill switch.", rule: "kill_switch" };
    else if (!settings.live_trading_enabled) breach = { reason: "Live trading is disabled.", rule: "live_trading_disabled" };
    if (breach) {
      const blockBody = buildRiskBlock(VERSION, {
        reason: breach.reason, rule: breach.rule, settings,
      }, { ticket, symbol, side, stopLoss, takeProfit });
      await auditRiskBlock(supabase, user.id, {
        tradeId: `modify-${ticket}`, symbol, side: side ?? "buy",
        volume: Number.isFinite(volume) ? volume : 0,
        reason: breach.reason, rule: breach.rule, response: blockBody, ticket,
      });
      return json(blockBody, 200);
    }
  } catch { /* fall through */ }


  // Broker-symbol gate — SL/TP modification must use the exact MT5 position broker symbol.
  const eligible = await resolveBrokerSymbolWithSelfHeal(supabase, {
    userId: user.id, traderId: accountId, accountId: mapping.tradingLayerAccountId,
    requestedDisplaySymbol: symbol, suppliedBrokerSymbol, operationType: "modify_protection",
  }, { targetUserId: user.id, canonicalForRefresh: symbol });
  if (!eligible.ok) {
    await ab("broker_symbol_gate", (eligible as any).reason || "broker_symbol_ineligible");
    return json(brokerSymbolGateResponse(VERSION, eligible, { ticket }), 200);
  }
  const brokerSymbol = eligible.brokerSymbol as string;

  // PART 1 — Fresh trade_mode refresh (≤30s execution-permission gate, modify).
  const fresh = await refreshTradeModeFromTradingLayer(supabase, {
    traderId: accountId, accountId: mapping.tradingLayerAccountId, brokerSymbol, login: mapping.login, server: mapping.server,
    operation: "modify_protection",
  });
  if (!fresh.ok) {
    await ab("fresh_trade_mode", (fresh as any).reason || "fresh_trade_mode_failed");
    return json(freshTradeModeGateResponse(VERSION, fresh, { ticket }), 200);
  }


  const idempotencyKey = `modify-${ticket}-${Date.now()}-${user.id}`;

    symbol: brokerSymbol,
    position: Number(ticket),
    side,
    volume: Number.isFinite(volume) ? volume : 0,
  };
  if (stopLoss !== null) modifyPayload.stopLoss = stopLoss;
  if (takeProfit !== null) modifyPayload.takeProfit = takeProfit;

  const startedAt = Date.now();
  let httpStatus = 0;
  let res: any = null;
  let networkError: string | null = null;
  try {
    const r = await fetch(`${BASE_URL}/api/v1/accounts/${accountId}/trades/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRADING_LAYER_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(modifyPayload),
    });
    httpStatus = r.status;
    const text = await r.text();
    try { res = JSON.parse(text); } catch { res = { rawText: text }; }
  } catch (e) {
    networkError = e instanceof Error ? e.message : String(e);
  }
  const latencyMs = Date.now() - startedAt;

  const retcode = res?.retcode != null ? Number(res.retcode) : null;
  // brokerMessage must always be a primitive string by the time it reaches
  // the client — otherwise React renders "[object Object]" in the toast.
  const stringifyErr = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      const obj = v as any;
      if (obj.code || obj.message) {
        return obj.code && obj.message ? `${obj.code}: ${obj.message}` : (obj.code || obj.message);
      }
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
  };
  const brokerMessage = stringifyErr(
    res?.brokerMessage ?? res?.message ?? res?.error ?? res?.retcodeDescription,
  );
  const brokerErrorCode: string | null =
    (res?.error && typeof res.error === "object" && res.error.code) ? String(res.error.code) :
    (res?.code ? String(res.code) : null);

  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const explicitSuccess = res?.success === true || retcode === 10009 || retcode === 10008;
  const explicitRejection =
    res?.success === false ||
    String(res?.status || "").toLowerCase() === "rejected" ||
    (retcode != null && retcode >= 10010 && retcode !== 10008);

  let status:
    | "protection_modified"
    | "protection_failed"
    | "protection_rejected"
    | "protection_blocked";
  let outcome: "success" | "rejected" | "failed" | "blocked";
  if (networkError || !httpOk) {
    if (httpStatus === 429) { status = "protection_blocked"; outcome = "blocked"; }
    else { status = "protection_failed"; outcome = "failed"; }
  } else if (explicitRejection) {
    status = "protection_rejected"; outcome = "rejected";
  } else if (explicitSuccess || httpOk) {
    status = "protection_modified"; outcome = "success";
  } else {
    status = "protection_failed"; outcome = "failed";
  }

  try {
    await supabase.from("execution_audit_events").insert({
      user_id: user.id,
      trade_id: `modify-${ticket}`,
      symbol,
      side,
      volume: Number.isFinite(volume) ? volume : 0,
      status,
      outcome,
      broker_message: brokerMessage,
      retcode,
      reason: outcome !== "success" ? (networkError || brokerMessage || res?.error || null) : null,
      latency_ms: latencyMs,
      ticket,
      raw: {
        classification: "modify_protection",
        version: VERSION,
        tradingLayerStatus: httpStatus,
        request: modifyPayload,
        response: res,
        networkError,
        appliedStopLoss: stopLoss,
        appliedTakeProfit: takeProfit,
        displaySymbol: symbol,
        brokerSymbol,
        symbolMappingSource: eligible.symbolMappingSource,
        symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
      },
    });
  } catch { /* ignore audit errors */ }

  return json({
    success: outcome === "success",
    version: VERSION,
    classification: "modify_protection",
    status,
    outcome,
    ticket,
    displaySymbol: symbol,
    brokerSymbol,
    symbol: brokerSymbol,
    symbolMappingSource: eligible.symbolMappingSource,
    symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
    stopLoss,
    takeProfit,
    retcode,
    brokerMessage,
    brokerErrorCode,
    latencyMs,
    tradingLayerStatus: httpStatus,
    // `error` MUST be a string. Never propagate the upstream object here —
    // toasts render it raw as `[object Object]`.
    error: outcome === "success"
      ? null
      : (brokerErrorCode || stringifyErr(networkError || brokerMessage) || "MODIFY_FAILED"),
  });
});
