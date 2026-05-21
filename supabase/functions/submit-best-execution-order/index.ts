// Best-Execution Order Router
// Wraps execute-trade with pre-trade quote snapshot + latency/slippage metrics.
//
// SPEED CONTRACT (v3):
//   - This function returns to the client as soon as Trading Layer responds.
//   - Reconciliation is owned by the client (BlackArrowTradePanel) which calls
//     reconcile-execution on a fast cadence carrying the IDs we surface here.
//   - Audit-row writes for accepted / unconfirmed orders run inside
//     EdgeRuntime.waitUntil so they never block the HTTP response.
//   - Risk-block / freshness / dry-run audits remain synchronous because the
//     client uses them to decide whether to even continue.
//
// Dev-mode timings (returned only when payload.devMode === true) cover:
//   requestReceivedAt, authValidatedAt, accountResolvedAt, riskValidatedAt,
//   freshTickFetchedAt, orderSentToTradingLayerAt, tradingLayerResponseAt,
//   firstReconcileStartedAt (always null here — client owns reconcile),
//   mt5ConfirmedAt (null), finalUiStatusAt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  loadRiskSettings,
  loadDailyUsage,
  checkOpenRisk,
  buildRiskBlock,
  auditRiskBlock,
} from "../_shared/risk.ts";

const VERSION = "BEST_EXEC_FAST_V3_2026_05_21";

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

// Fire-and-forget on Deno deploy — survives the response if supported.
const fireAndForget = (p: Promise<unknown>) => {
  try {
    // @ts-ignore -- Deno Deploy / Supabase Edge Runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p.catch(() => {}));
    } else {
      p.catch(() => {});
    }
  } catch { /* ignore */ }
};

// Extract a value from any of the documented Trading Layer shapes.
const pick = (obj: any, paths: string[]): any => {
  if (!obj || typeof obj !== "object") return null;
  for (const path of paths) {
    const v = path
      .split(".")
      .reduce<any>((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
    if (v !== undefined && v !== null) return v;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const timings: Record<string, number | null> = {
    requestReceivedAt: Date.now(),
    authValidatedAt: null,
    accountResolvedAt: null,
    riskValidatedAt: null,
    freshTickFetchedAt: null,
    orderSentToTradingLayerAt: null,
    tradingLayerResponseAt: null,
    firstReconcileStartedAt: null, // owned by client
    mt5ConfirmedAt: null,           // owned by client
    finalUiStatusAt: null,
  };

  const authHeader = req.headers.get("Authorization") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const {
    tradeId,
    symbol,
    side,
    orderType = "market",
    volume,
    stopLoss = null,
    takeProfit = null,
    clientClickAt,
    dryRun = false,
    liveExecutionConfirmed = false,
    devModeAllowMissingQuote = false,
    devMode = false,
  } = payload || {};

  const withTimings = (body: Record<string, unknown>, status = 200) => {
    timings.finalUiStatusAt = Date.now();
    return json(devMode ? { ...body, timings } : body, status);
  };

  if (!symbol || !side || !volume) {
    return withTimings({
      success: false,
      error: "Missing required fields",
      reasons: ["symbol, side and volume are required"],
    }, 400);
  }
  if (orderType && String(orderType).toLowerCase() !== "market") {
    return withTimings({
      success: false,
      error: "Only market orders are supported by this router",
      reasons: [`orderType=${orderType} not supported`],
    }, 400);
  }

  const supabase = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // Cache the auth lookup once.
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id ?? null;
  timings.authValidatedAt = Date.now();

  // Pre-trade quote snapshot for slippage measurement + freshness gate.
  let requestedBid: number | null = null;
  let requestedAsk: number | null = null;
  let quoteTimestamp: string | null = null;
  let quoteSource: string | null = null;
  try {
    const { data: q } = await supabase.functions.invoke("get-mt5-quotes", {
      body: { selectedSymbol: symbol, symbols: [symbol], debug: false },
    });
    const row = Array.isArray(q?.quotes)
      ? q.quotes.find((r: any) => String(r?.symbol || "").toUpperCase() === String(symbol).toUpperCase())
      : null;
    if (row) {
      requestedBid = row.bid != null ? Number(row.bid) : null;
      requestedAsk = row.ask != null ? Number(row.ask) : null;
      quoteTimestamp = row.timestamp ?? row.time ?? row.ts ?? new Date().toISOString();
      quoteSource = row.source ?? "get-mt5-quotes";
    }
  } catch { /* ignore — quote snapshot is best-effort */ }
  timings.freshTickFetchedAt = Date.now();

  const requestedPrice =
    side === "buy" ? requestedAsk : side === "sell" ? requestedBid : null;
  const haveFreshQuote =
    requestedBid != null && requestedAsk != null && requestedPrice != null;

  const startedAt = Date.now();
  const clientLatencyMs = clientClickAt
    ? Math.max(0, startedAt - Date.parse(clientClickAt))
    : null;

  // ---------------------------------------------------------------------------
  // DRY RUN — short-circuit before any Trading Layer call.
  // ---------------------------------------------------------------------------
  if (dryRun === true) {
    const spreadDry =
      requestedBid != null && requestedAsk != null
        ? Math.max(0, requestedAsk - requestedBid)
        : null;
    if (uid) {
      fireAndForget(supabase.from("execution_audit_events").insert({
        user_id: uid,
        trade_id: tradeId ?? null,
        symbol,
        side,
        volume: Number(volume),
        status: "dry_run",
        outcome: "success",
        requested_price: requestedPrice,
        executed_price: null,
        slippage: null,
        latency_ms: Math.round(Date.now() - startedAt),
        spread: spreadDry,
        bid: requestedBid,
        ask: requestedAsk,
        broker_message: "Pre-trade check OK (dry run)",
        retcode: null,
        reason: null,
        rule_violated: null,
        ticket: null,
        raw: {
          classification: "pretrade_check",
          version: VERSION,
          step: "dry_run",
          liveOrderSent: false,
        },
      }));
    }
    return withTimings({
      success: true,
      version: VERSION,
      step: "dry_run",
      liveOrderSent: false,
    });
  }

  if (liveExecutionConfirmed !== true) {
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_validation",
      liveOrderSent: false,
      error: "Live execution requires liveExecutionConfirmed=true.",
      reasons: ["Missing live execution confirmation"],
    });
  }

  // ---------- Backend risk enforcement (always synchronous) ----------
  try {
    if (uid) {
      const settings = await loadRiskSettings(supabase, uid);
      const usage = await loadDailyUsage(supabase, uid);
      const breach = checkOpenRisk(
        { symbol, volume: Number(volume) },
        settings,
        usage,
      );
      if (breach) {
        const blockBody = buildRiskBlock(VERSION, {
          reason: breach.reason,
          rule: breach.rule,
          settings,
          usage,
        }, { tradeId, symbol, side, volume: Number(volume) });
        // Synchronous audit so client can rely on it for risk_blocked toasts.
        await auditRiskBlock(supabase, uid, {
          tradeId, symbol, side, volume: Number(volume),
          reason: breach.reason, rule: breach.rule, response: blockBody,
        });
        timings.riskValidatedAt = Date.now();
        return withTimings(blockBody);
      }
    }
  } catch { /* if risk lookup fails entirely, fall through (audit only) */ }
  timings.riskValidatedAt = Date.now();

  // Freshness gate — refuse live execution without a fresh server-side tick.
  if (!haveFreshQuote && devModeAllowMissingQuote !== true) {
    if (uid) {
      fireAndForget(supabase.from("execution_audit_events").insert({
        user_id: uid,
        trade_id: tradeId ?? null,
        symbol,
        side,
        volume: Number(volume),
        status: "blocked",
        outcome: "blocked",
        requested_price: requestedPrice,
        executed_price: null,
        slippage: null,
        latency_ms: Math.round(Date.now() - startedAt),
        spread:
          requestedBid != null && requestedAsk != null
            ? Math.max(0, requestedAsk - requestedBid)
            : null,
        bid: requestedBid,
        ask: requestedAsk,
        broker_message: "Blocked: no fresh server-side tick available.",
        retcode: null,
        reason: "missing_fresh_tick",
        rule_violated: "fresh_tick_required",
        ticket: null,
        raw: {
          classification: "blocked",
          version: VERSION,
          step: "pretrade_validation",
          liveOrderSent: false,
          quote_bid: requestedBid,
          quote_ask: requestedAsk,
          quote_timestamp: quoteTimestamp,
          quote_source: quoteSource,
        },
      }));
    }
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_validation",
      liveOrderSent: false,
      tradeId,
      error: "No fresh server-side tick available — refusing to send live order.",
      reasons: ["Missing fresh bid/ask snapshot. Try again or enable Dev Mode bypass."],
      requestedPrice,
      bid: requestedBid,
      ask: requestedAsk,
      quoteTimestamp,
    });
  }

  // Resolve mapping once — purely for diagnostics. execute-trade resolves
  // and uses metaapi_account_id (= trading_layer_trader_id) internally.
  let mapping: { localRowId: string | null; traderId: string | null; login: string | null; server: string | null } = {
    localRowId: null, traderId: null, login: null, server: null,
  };
  if (uid) {
    try {
      const { data: acc } = await supabase
        .from("user_mt_accounts")
        .select("id, metaapi_account_id, trading_layer_trader_id, login, server_name")
        .eq("user_id", uid)
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (acc) {
        mapping = {
          localRowId: String((acc as any).id ?? "") || null,
          traderId: String((acc as any).trading_layer_trader_id ?? (acc as any).metaapi_account_id ?? "") || null,
          login: (acc as any).login ?? null,
          server: (acc as any).server_name ?? null,
        };
      }
    } catch { /* diagnostics-only */ }
  }
  timings.accountResolvedAt = Date.now();

  // Forward to execute-trade (existing broker integration).
  timings.orderSentToTradingLayerAt = Date.now();
  const { data: execData, error: execError } = await supabase.functions.invoke(
    "execute-trade",
    {
      body: {
        tradeId,
        symbol,
        side,
        volume: Number(volume),
        stopLoss: stopLoss == null ? null : Number(stopLoss),
        takeProfit: takeProfit == null ? null : Number(takeProfit),
      },
    },
  );
  timings.tradingLayerResponseAt = Date.now();

  const serverLatencyMs = Date.now() - startedAt;
  const totalLatencyMs =
    clientLatencyMs != null ? clientLatencyMs + serverLatencyMs : serverLatencyMs;

  // Try to recover JSON body from supabase-js FunctionsHttpError context.
  let res: any = execData;
  if (execError && !res) {
    try {
      const ctx: any = (execError as any)?.context;
      if (ctx?.json) res = await ctx.json();
      else if (ctx?.text) res = JSON.parse(await ctx.text());
    } catch { /* ignore */ }
  }

  if (!res) {
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_validation",
      liveOrderSent: false,
      tradeId,
      error: (execError as any)?.message || "execute-trade returned no body",
      latencyMs: totalLatencyMs,
      requestedPrice,
    });
  }

  // Extract every ID Trading Layer might return so the client can use them
  // as primary reconciliation keys (positionTicket → dealId → orderId →
  // requestId/clientOrderId → fallback symbol+side+vol match).
  const result = res?.data ?? res;
  const positionTicket = pick(result, [
    "position.ticket", "position.id", "positionTicket",
    "ticket", "data.ticket",
  ]);
  const orderTicket = pick(result, [
    "order.ticket", "order.id", "orderId", "order_id",
    "data.order.ticket", "ticketOrder",
  ]);
  const dealId = pick(result, [
    "deal.ticket", "deal.id", "dealId", "deal_id",
    "data.deal.ticket", "data.deal.id",
  ]);
  const requestId = pick(result, [
    "requestId", "request_id", "clientOrderId", "client_order_id",
    "tradeId", "data.requestId",
  ]) ?? tradeId ?? null;
  const responseSymbol = pick(result, ["symbol", "data.symbol", "order.symbol", "position.symbol"]);
  const responseVolume = pick(result, ["volume", "data.volume", "order.volume", "deal.volume"]);
  const responsePrice = pick(result, ["price", "data.price", "deal.price", "order.price", "openPrice", "open_price"]);
  const responseSide = pick(result, ["side", "data.side", "order.side"]);

  const executedPrice =
    res.price ?? res.openPrice ?? res.executedPrice ?? responsePrice ?? null;
  const slippage =
    requestedPrice != null && executedPrice != null
      ? Number(executedPrice) - Number(requestedPrice)
      : null;
  const brokerMessageRaw =
    res.brokerMessage ??
    res.retcodeDescription ??
    res.retcode_description ??
    res.message ??
    res.error ??
    null;

  const retcodeNum = res.retcode != null && Number.isFinite(Number(res.retcode))
    ? Number(res.retcode)
    : null;

  // Retcode taxonomy for market orders
  //   10009 = TRADE_RETCODE_DONE       → filled
  //   10008 = TRADE_RETCODE_PLACED     → accepted, NOT confirmed
  const retcodeFilled = retcodeNum === 10009;
  const retcodeAccepted = retcodeNum === 10008;

  const upstreamSuccess = res.success === true;
  const upstreamStatus = String(res.status ?? res.classification ?? "").toLowerCase();
  const isBlocked =
    upstreamStatus === "blocked" ||
    res.blocked === true ||
    (Array.isArray(res.reasons) && res.reasons.length > 0 && retcodeNum == null);
  const isPlacedOnly =
    retcodeAccepted ||
    (upstreamSuccess && !retcodeFilled && executedPrice == null) ||
    upstreamStatus === "placed";

  // ---------------------------------------------------------------------------
  // Final lifecycle determination — NO blocking reconciliation here.
  //  - If broker accepted → status: broker_accepted_pending_confirmation
  //  - Client owns the reconcile-execution loop using the IDs below.
  // ---------------------------------------------------------------------------
  const brokerAccepted = upstreamSuccess || retcodeFilled || retcodeAccepted || isPlacedOnly;
  const liveOrderSent = brokerAccepted;

  let success: boolean;
  let status: string;
  let outcome: string;
  let step: string;
  let classification: string;
  let brokerMessage = brokerMessageRaw;

  if (isBlocked) {
    success = false;
    status = "blocked";
    outcome = "blocked";
    step = "pretrade_validation";
    classification = "blocked";
  } else if (brokerAccepted) {
    // Client must run reconcile-execution to flip to position_confirmed.
    success = true; // broker accepted, optimistic non-final state for the UI
    status = "broker_accepted_pending_confirmation";
    outcome = "broker_accepted";
    step = "execution_result";
    classification = "broker_accepted";
    brokerMessage = "Broker accepted — waiting for MT5 confirmation.";
  } else {
    success = false;
    status = "rejected";
    outcome = "rejected";
    step = "pretrade_validation";
    classification = "rejected";
  }

  const spread =
    requestedBid != null && requestedAsk != null
      ? Math.max(0, requestedAsk - requestedBid)
      : null;
  const reasonsText = Array.isArray(res.reasons) ? res.reasons.join(" · ") : null;

  // Sanitized diagnostics (no secrets) — surfaced in Dev Mode by the UI.
  const diagnostics = {
    payloadSent: {
      tradeId, symbol, side, orderType, volume: Number(volume),
      stopLoss, takeProfit,
    },
    rawTradingLayerResponse: res,
    transport: "rest",
    accountIdUsed: mapping.traderId,
    localRowId: mapping.localRowId,
    tradingLayerTraderId: mapping.traderId,
    mt5Login: mapping.login,
    mt5Server: mapping.server,
    brokerSymbol: responseSymbol ?? symbol,
    displaySymbol: symbol,
    side: responseSide ?? side,
    volume: responseVolume != null ? Number(responseVolume) : Number(volume),
    retcode: retcodeNum,
    retcodeDescription:
      res.retcodeDescription ?? res.retcode_description ?? brokerMessageRaw ?? null,
    orderId: orderTicket != null ? String(orderTicket) : null,
    dealId: dealId != null ? String(dealId) : null,
    positionTicket: positionTicket != null ? String(positionTicket) : null,
    requestId: requestId != null ? String(requestId) : null,
    clientOrderId: tradeId ?? null,
    brokerResponseTimeMs: timings.tradingLayerResponseAt && timings.orderSentToTradingLayerAt
      ? (timings.tradingLayerResponseAt - timings.orderSentToTradingLayerAt)
      : null,
  };

  // Audit insert — fire-and-forget for accepted/unconfirmed paths; synchronous
  // ONLY for rejection (so the UI can rely on it for incident reporting).
  if (uid) {
    const auditRow = {
      user_id: uid,
      trade_id: tradeId ?? null,
      symbol,
      side,
      volume: Number(volume),
      status,
      outcome,
      requested_price: requestedPrice,
      executed_price: executedPrice != null ? Number(executedPrice) : null,
      slippage,
      latency_ms: Math.round(totalLatencyMs),
      spread,
      bid: requestedBid,
      ask: requestedAsk,
      broker_message: brokerMessage,
      retcode: retcodeNum,
      reason: outcome === "blocked" || outcome === "rejected"
        ? (res.error || reasonsText || brokerMessage || null)
        : null,
      rule_violated: outcome === "blocked" ? (res.ruleViolated || reasonsText || res.error || null) : null,
      ticket: positionTicket != null ? String(positionTicket) : null,
      raw: {
        ...(res && typeof res === "object" ? res : {}),
        classification,
        version: VERSION,
        step,
        liveOrderSent,
        brokerAccepted,
        positionTicket: diagnostics.positionTicket,
        orderId: diagnostics.orderId,
        dealId: diagnostics.dealId,
        requestId: diagnostics.requestId,
        quote_bid: requestedBid,
        quote_ask: requestedAsk,
        quote_spread: spread,
        quote_timestamp: quoteTimestamp,
        quote_source: quoteSource,
        diagnostics,
      },
    };
    if (outcome === "rejected") {
      try { await supabase.from("execution_audit_events").insert(auditRow); } catch { /* swallow */ }
    } else {
      fireAndForget(supabase.from("execution_audit_events").insert(auditRow));
    }
  }

  return withTimings({
    success,
    version: VERSION,
    step,
    liveOrderSent,
    brokerAccepted,
    mt5Confirmed: false, // never true here — client owns confirmation
    confirmationStatus: brokerAccepted ? "broker_accepted_pending_confirmation" : (isBlocked ? "blocked" : "rejected"),
    tradeId,
    status,
    outcome,
    classification,
    requestedPrice,
    executedPrice: executedPrice != null ? Number(executedPrice) : null,
    slippage,
    latencyMs: totalLatencyMs,
    clientLatencyMs,
    serverLatencyMs,
    spread,
    bid: requestedBid,
    ask: requestedAsk,
    brokerMessage,
    // Surface every ID the client may use as a reconciliation key.
    ticket: diagnostics.positionTicket,
    positionTicket: diagnostics.positionTicket,
    orderId: diagnostics.orderId,
    dealId: diagnostics.dealId,
    requestId: diagnostics.requestId,
    clientOrderId: diagnostics.clientOrderId,
    brokerSymbol: diagnostics.brokerSymbol,
    retcode: retcodeNum,
    error: success ? null : (res.error || brokerMessage || "Order rejected"),
    reasons: res.reasons ?? null,
    diagnostics,
  });
});
