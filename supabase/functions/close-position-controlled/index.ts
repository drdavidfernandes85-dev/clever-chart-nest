// Close Position (Controlled) — developer-only safe close path.
// Only allows volume <= 0.01 during testing. Does NOT use execute-trade.
// Calls Trading Layer directly with POSITION_CLOSE_ID and logs to
// execution_audit_events with classification = close_position.
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
import { EXECUTION_POLICY_VERSION } from "../_shared/tradingLayerTradeMode.ts";
import {
  fetchTradingLayerLivePositions,
  evaluateCloseAuthority,
  upsertMirrorFromLive,
} from "../_shared/livePositions.ts";

const VERSION = "CLOSE_POSITION_ROUTE_FIX_V4_2026_05_28";
const BASE_URL = "https://api.trading-layer.com";
const MAX_TEST_VOLUME = 0.01;

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

  // 1. Authenticate
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

  // 2. Parse & validate payload — accepts spec payload {closeId, ticket, symbol, openSide, volume, liveCloseConfirmed, clientClickAt} or legacy {ticket, symbol, volume, side}.
  let payload: any;
  try { payload = await req.json(); } catch {
    return json({ success: false, version: VERSION, error: "Invalid JSON body" }, 400);
  }
  const ticket = payload?.ticket != null ? String(payload.ticket) : null;
  const symbol = payload?.symbol ? String(payload.symbol).toUpperCase() : null;
  const suppliedBrokerSymbol = payload?.brokerSymbol ? String(payload.brokerSymbol) : null;
  const volume = Number(payload?.volume);
  const openVolume = Number(payload?.openVolume);
  const openSideRaw = payload?.openSide ? String(payload.openSide).toLowerCase() : null;
  const sideRaw = payload?.side ? String(payload.side).toLowerCase() : null;
  // Prefer derived closeSide from openSide; fall back to legacy 'side'.
  const closeSide = openSideRaw === "buy" ? "sell"
                  : openSideRaw === "sell" ? "buy"
                  : (sideRaw === "buy" || sideRaw === "sell") ? sideRaw
                  : null;
  const closeId = typeof payload?.closeId === "string" && payload.closeId.length > 0
    ? payload.closeId
    : `close-${ticket}-${Date.now()}`;
  const devMode = payload?.devMode === true;

  if (!ticket || !symbol || !Number.isFinite(volume) || volume <= 0 || (closeSide !== "buy" && closeSide !== "sell")) {
    return json({
      success: false, version: VERSION,
      error: "ticket, symbol, volume and openSide|side (buy|sell) are required",
    }, 400);
  }
  if (openSideRaw && payload?.liveCloseConfirmed !== true) {
    return json({
      success: false, version: VERSION,
      error: "liveCloseConfirmed=true is required for live closes",
    }, 400);
  }
  if (volume > MAX_TEST_VOLUME) {
    return json({
      success: false, version: VERSION,
      error: `Close blocked: volume ${volume} exceeds test cap ${MAX_TEST_VOLUME}`,
    }, 400);
  }

  // 3. Load connected MT5 account via shared mapping resolver so we always
  //    pick the freshest, validated trading-layer mapping instead of a stale
  //    ownerAccountId row.
  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status === "missing") {
    return json({
      success: false, version: VERSION,
      error: "No connected MT5 account found",
    }, 404);
  }
  if (mapping.status === "stale" || !mapping.traderId) {
    return json({
      success: false, version: VERSION,
      error: STALE_MAPPING_ERROR_CODE,
      message: STALE_MAPPING_USER_MESSAGE,
      mappingStatus: mapping.status,
      localRowId: mapping.localRowId,
    }, 409);
  }
  const accountId = mapping.traderId;
  // CRITICAL ROUTE INVARIANT — close mutations MUST use the verified Trading
  // Layer execution route accountId (same value used by the proven entry
  // path), not the traderId. The traderId is for positions/account lookups
  // only; using it for /trades/send yields TRADE_RETCODE_TRADE_DISABLED.
  const routeAccountId = mapping.tradingLayerAccountId;
  if (!routeAccountId) {
    return json({
      success: false, version: VERSION,
      error: "CLOSE_EXECUTION_ROUTE_UNRESOLVED",
      message: "Verified Trading Layer execution route accountId is missing on the MT5 mapping.",
      brokerCloseMutationDispatched: false,
    }, 409);
  }
  const callerRouteAccountId = typeof payload?.routeAccountId === "string" ? payload.routeAccountId : null;
  if (callerRouteAccountId && callerRouteAccountId !== routeAccountId) {
    return json({
      success: false, version: VERSION,
      error: "CLOSE_EXECUTION_ROUTE_MISMATCH",
      expectedRouteAccountId: routeAccountId,
      attemptedRouteAccountId: callerRouteAccountId,
      brokerCloseMutationDispatched: false,
    }, 409);
  }
  // Hard guard: never let traderId be used as the URL accountId.
  if (routeAccountId === mapping.traderId && mapping.tradingLayerAccountId !== mapping.traderId) {
    return json({
      success: false, version: VERSION,
      error: "CLOSE_EXECUTION_ROUTE_MISMATCH",
      detail: "trader_id_used_as_route",
      brokerCloseMutationDispatched: false,
    }, 409);
  }

  // Preview / no-mutation diagnostic — returns the exact endpoint and DTO
  // the corrected close path would dispatch, without sending any request.
  if (payload?.previewOnly === true || payload?.validateOnly === true) {
    return json({
      success: true,
      version: VERSION,
      validationOnly: true,
      mutationSuppressed: true,
      closeAuthoritySource: "trading_layer_live_forced",
      verifiedRouteAccountId: routeAccountId,
      wrongPriorRouteAccountId: mapping.traderId,
      routeMismatchFixed: true,
      expectedEndpoint: `/api/v1/accounts/${routeAccountId}/trades/send`,
      brokerSymbol: suppliedBrokerSymbol ?? symbol,
      closeSide,
      volume,
      positionTicket: ticket,
      outboundCloseDTO: {
        side: closeSide, symbol: suppliedBrokerSymbol ?? symbol, volume,
        position: Number(ticket), deviation: 20,
      },
      brokerCloseMutationDispatched: false,
    });
  }

  // ---------- Execution-mode allowlist (admin live testing gate) ----------
  {
    const gate = await assertLiveExecutionAllowed(supabase, user.id, {
      traderId: mapping.traderId,
      login: mapping.login,
    });
    if (!gate.allowed) {
      return json({
        success: false,
        version: VERSION,
        error: gate.code || LIVE_EXEC_DISABLED_CODE,
        reason: gate.reason,
        executionMode: gate.mode,
      }, 403);
    }
  }


  // ---------- Backend risk-limit enforcement (LIMITS ONLY — ticket existence
  // is authoritatively verified later via forced live Trading Layer lookup).
  // The old mt_positions-mirror "ticket_not_live" rule has been removed: a stale
  // local mirror MUST NOT block a risk-reducing close on a live-confirmed ticket.
  let settings: any = null;
  try {
    settings = await loadRiskSettings(supabase, user.id);
    if (settings?.kill_switch_enabled) {
      const blockBody = buildRiskBlock(VERSION, {
        reason: "Trading disabled by kill switch.", rule: "kill_switch", settings,
      }, { ticket, symbol, side: closeSide, volume, closeId });
      await auditRiskBlock(supabase, user.id, {
        tradeId: `close-${ticket}`, symbol, side: closeSide, volume,
        reason: "kill_switch", rule: "kill_switch", response: blockBody, ticket,
      });
      return json(blockBody, 200);
    }
    if (settings && !settings.live_trading_enabled) {
      const blockBody = buildRiskBlock(VERSION, {
        reason: "Live trading is disabled.", rule: "live_trading_disabled", settings,
      }, { ticket, symbol, side: closeSide, volume, closeId });
      return json(blockBody, 200);
    }
  } catch { /* fall through */ }



  // Broker-symbol gate — close must use exact MT5 broker symbol from the position.
  const eligible = await resolveEligibleBrokerSymbol(supabase, {
    userId: user.id,
    traderId: accountId,
    accountId: mapping.tradingLayerAccountId,
    requestedDisplaySymbol: symbol,
    suppliedBrokerSymbol,
    operationType: "close_position",
  });
  if (!eligible.ok) {
    return json(brokerSymbolGateResponse(VERSION, eligible, { ticket, closeId, volume }), 200);
  }
  const brokerSymbol = eligible.brokerSymbol as string;

  // PART 1 — Fresh trade_mode refresh (≤30s execution-permission gate, close).
  const fresh = await refreshTradeModeFromTradingLayer(supabase, {
    traderId: accountId, accountId: mapping.tradingLayerAccountId, brokerSymbol, login: mapping.login, server: mapping.server,
    operation: "close_position",
  });
  if (!fresh.ok) {
    return json(freshTradeModeGateResponse(VERSION, fresh, { ticket, closeId, volume }), 200);
  }


  // ---------- AUTHORITATIVE LIVE TICKET VERIFICATION ----------
  // Forced fresh read of live Trading Layer positions for this exact account
  // route. This is the sole source of truth for whether the requested ticket
  // is actually open right now. Local mt_positions is mirror-only: if it is
  // stale we self-heal it from the live result, but we never block on it.
  const expectedOpenSide = closeSide === "buy" ? "sell" : "buy";
  const live = await fetchTradingLayerLivePositions(accountId);
  const authority = evaluateCloseAuthority(live, {
    requestedTicket: String(ticket),
    expectedTicket: payload?.expectedTicket != null ? String(payload.expectedTicket) : null,
    expectedBrokerSymbol: brokerSymbol,
    expectedSide: expectedOpenSide as "buy" | "sell",
    expectedVolume: Number(payload?.openVolume ?? volume),
  });
  let mirrorAction: "inserted" | "updated" | "skipped" | "failed" | "not_attempted" = "not_attempted";
  if (authority.code === "LIVE_POSITION_CONFIRMED_FOR_CLOSE" && authority.livePosition) {
    // Self-heal the mirror; never required for the close to proceed.
    const repair = await upsertMirrorFromLive(supabase, {
      userId: user.id,
      accountUuid: mapping.localRowId ?? mapping.tradingLayerAccountId ?? accountId,
      live: authority.livePosition,
      brokerSymbol,
    });
    mirrorAction = repair.action;
  }
  if (authority.code !== "LIVE_POSITION_CONFIRMED_FOR_CLOSE") {
    const blockBody = {
      success: false,
      version: VERSION,
      step: "live_ticket_verification",
      status: "blocked",
      classification: "controlled_close_live_ticket_verification_failed",
      authorityCode: authority.code,
      authorityDetail: authority.detail ?? null,
      liveLookup: {
        ok: live.ok, httpStatus: live.httpStatus, fetchedAt: live.fetchedAt,
        source: live.source, positionsCount: live.positions.length, error: live.error ?? null,
      },
      requestedTicket: String(ticket),
      expectedBrokerSymbol: brokerSymbol,
      expectedSide: expectedOpenSide,
      expectedVolume: Number(payload?.openVolume ?? volume),
      brokerMutationDispatched: false,
      mirrorAction,
    };
    try {
      await supabase.from("execution_audit_events").insert({
        user_id: user.id,
        trade_id: `close-${ticket}`,
        symbol, side: closeSide, volume,
        status: "blocked", outcome: "blocked",
        broker_message: authority.code,
        reason: authority.detail ?? authority.code,
        rule_violated: authority.code,
        ticket: String(ticket),
        raw: { classification: "controlled_close_live_ticket_verification_failed", response_payload: blockBody },
      });
    } catch { /* swallow */ }
    return json(blockBody, 200);
  }

  const idempotencyKey = closeId;

  const closePayload = {
    side: closeSide,
    symbol: brokerSymbol,
    volume,
    position: Number(ticket),
    deviation: 20,
  };

  const startedAt = Date.now();
  let httpStatus = 0;
  let res: any = null;
  let raw: any = null;
  let networkError: string | null = null;
  try {
    const r = await fetch(`${BASE_URL}/api/v1/accounts/${routeAccountId}/trades/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRADING_LAYER_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(closePayload),
    });
    httpStatus = r.status;
    const text = await r.text();
    raw = text;
    try { res = JSON.parse(text); } catch { res = { rawText: text }; }
  } catch (e) {
    networkError = e instanceof Error ? e.message : String(e);
  }
  const latencyMs = Date.now() - startedAt;

  // 5. Classify outcome. Trading Layer may wrap trade results under `data`.
  // HTTP 200 only means the API answered; it is NOT broker acceptance.
  const tlResult = res?.data && typeof res.data === "object" ? res.data : res;
  const retcode = tlResult?.retcode != null ? Number(tlResult.retcode) : null;
  const brokerMessage =
    res?.brokerMessage ?? tlResult?.brokerMessage ?? res?.message ?? res?.error ?? tlResult?.retcode_description ?? tlResult?.retcodeDescription ?? null;
  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const explicitSuccess = res?.success === true || retcode === 10009 || retcode === 10008;
  const explicitRejection =
    res?.success === false ||
    String(res?.status || tlResult?.status || tlResult?.classification || "").toLowerCase() === "rejected" ||
    (retcode != null && retcode >= 10010 && retcode !== 10008);

  const isPartial =
    Number.isFinite(openVolume) && openVolume > 0 && volume + 1e-8 < openVolume;
  let status: "closed" | "partial_closed" | "close_failed" | "close_rejected";
  let outcome: "success" | "rejected" | "failed";
  if (networkError || !httpOk) {
    status = "close_failed";
    outcome = "failed";
  } else if (explicitRejection) {
    status = "close_rejected";
    outcome = "rejected";
  } else if (explicitSuccess) {
    status = isPartial ? "partial_closed" : "closed";
    outcome = "success";
  } else {
    status = "close_failed";
    outcome = "failed";
  }

  // 6. Audit insert (best-effort)
  try {
    await supabase.from("execution_audit_events").insert({
      user_id: user.id,
      trade_id: `close-${ticket}`,
      symbol,
      side: closeSide,
      volume,
      status,
      outcome,
      requested_price: null,
      executed_price: res?.price != null ? Number(res.price) : null,
      slippage: null,
      latency_ms: latencyMs,
      spread: null,
      bid: null,
      ask: null,
      broker_message: brokerMessage,
      retcode,
      reason: outcome !== "success" ? (networkError || brokerMessage || res?.error || null) : null,
      rule_violated: null,
      ticket,
      raw: {
        classification: "close_position",
        version: VERSION,
        tradingLayerStatus: httpStatus,
        request: closePayload,
        response: res,
        networkError,
        closeId,
        openVolume: Number.isFinite(openVolume) ? openVolume : null,
        partial: isPartial,
        clientClickAt: typeof payload?.clientClickAt === "string" ? payload.clientClickAt : null,
        displaySymbol: symbol,
        brokerSymbol,
        symbolMappingSource: eligible.symbolMappingSource,
        symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
        liveAuthority: {
          code: "LIVE_POSITION_CONFIRMED_FOR_CLOSE",
          source: live.source,
          fetchedAt: live.fetchedAt,
          mirrorAction,
        },
      },
    });
  } catch { /* swallow audit errors */ }

  // Surface raw TL IDs so the client can ID-first reconcile this close.
  const orderId = res?.orderId ?? res?.order ?? res?.order_id ?? tlResult?.order ?? null;
  const dealId = res?.dealId ?? res?.deal ?? res?.deal_id ?? tlResult?.deal ?? null;
  const requestId = res?.requestId ?? res?.request_id ?? null;
  const positionTicket = res?.positionTicket ?? res?.position ?? Number(ticket) ?? null;
  const brokerSymbolOut = res?.brokerSymbol ?? res?.symbol ?? brokerSymbol;
  const retcodeName = res?.retcodeName ?? tlResult?.retcode_name ?? null;
  const retcodeDescription = res?.retcodeDescription ?? tlResult?.retcode_description ?? null;

  return json({
    success: outcome === "success",
    version: VERSION,
    classification: "close_position",
    status,
    partial: isPartial,
    closeId,
    clientCloseId: closeId,
    ticket,
    positionTicket,
    orderId,
    dealId,
    requestId,
    displaySymbol: symbol,
    brokerSymbol: brokerSymbolOut,
    symbol: brokerSymbolOut,
    symbolMappingSource: eligible.symbolMappingSource,
    symbolMappingCheckedAt: eligible.symbolMappingCheckedAt,
    volume,
    retcode,
    retcodeName,
    retcodeDescription,
    brokerMessage,
    latencyMs,
    tradingLayerStatus: httpStatus,
    metaapi_account_id: accountId,
    brokerCloseMutationDispatched: true,
    endpointPath: `/api/v1/accounts/${accountId}/trades/send`,
    outboundDto: closePayload,
    ...(devMode ? { executionPolicyVersion: EXECUTION_POLICY_VERSION } : {}),
    error: outcome === "success" ? null : (networkError || brokerMessage || "Close failed"),
  });
});
