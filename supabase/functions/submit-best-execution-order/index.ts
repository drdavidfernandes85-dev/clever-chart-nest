// Best-Execution Order Router
// Wraps execute-trade with pre-trade quote snapshot + latency/slippage metrics.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  loadRiskSettings,
  loadDailyUsage,
  checkOpenRisk,
  buildRiskBlock,
  auditRiskBlock,
} from "../_shared/risk.ts";

const VERSION = "BEST_EXEC_RISK_ENFORCED_V2_2026_05_19";

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
  } = payload || {};

  if (!symbol || !side || !volume) {
    return json(
      {
        success: false,
        error: "Missing required fields",
        reasons: ["symbol, side and volume are required"],
      },
      400,
    );
  }
  if (orderType && String(orderType).toLowerCase() !== "market") {
    return json(
      {
        success: false,
        error: "Only market orders are supported by this router",
        reasons: [`orderType=${orderType} not supported`],
      },
      400,
    );
  }

  const supabase = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

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
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        await supabase.from("execution_audit_events").insert({
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
        });
      }
    } catch { /* swallow */ }
    return json({
      success: true,
      version: VERSION,
      step: "dry_run",
      liveOrderSent: false,
    });
  }

  if (liveExecutionConfirmed !== true) {
    return json({
      success: false,
      version: VERSION,
      step: "pretrade_validation",
      liveOrderSent: false,
      error: "Live execution requires liveExecutionConfirmed=true.",
      reasons: ["Missing live execution confirmation"],
    }, 200);
  }

  // Freshness gate — refuse live execution without a fresh server-side tick
  // unless Dev Mode explicitly authorises emergency testing.
  if (!haveFreshQuote && devModeAllowMissingQuote !== true) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        await supabase.from("execution_audit_events").insert({
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
            quote_spread:
              requestedBid != null && requestedAsk != null
                ? Math.max(0, requestedAsk - requestedBid)
                : null,
            quote_timestamp: quoteTimestamp,
            quote_source: quoteSource,
          },
        });
      }
    } catch { /* swallow */ }
    return json({
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
    }, 200);
  }


  // Forward to execute-trade (existing broker integration).
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
    return json({
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

  const executedPrice =
    res.price ?? res.openPrice ?? res.executedPrice ?? null;
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

  // Normalize confirmed entry price from any Trading Layer field shape.
  const extractEntryPrice = (p: any): number | null => {
    if (!p || typeof p !== "object") return null;
    const v =
      p.entry_price ?? p.price_open ?? p.priceOpen ??
      p.openPrice ?? p.open_price ?? p.price ?? p.entry ?? null;
    const n = v == null ? null : Number(v);
    return n != null && Number.isFinite(n) && n !== 0 ? n : null;
  };

  // ---------------------------------------------------------------------------
  // Reconcile against LIVE MT5 positions when the broker only "accepted".
  // ---------------------------------------------------------------------------
  let mt5Confirmed = false;
  let confirmedTicket: string | null = null;
  let confirmedPosition: any = null;
  let reconciliationAttempts = 0;
  let positionsSnapshot: any[] = [];
  let liveAcctDiag: any = null;

  if (retcodeFilled || isPlacedOnly) {
    const wantSym = String(symbol).toUpperCase();
    const wantSide = String(side).toLowerCase();
    const wantVol = Number(volume);
    const cadence = [0, 1500, 3000];
    for (const delay of cadence) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      reconciliationAttempts++;
      try {
        const { data: live } = await supabase.functions.invoke("get-live-account", { body: {} });
        liveAcctDiag = live ? {
          accountId: live?.account?.traderId ?? null,
          login: live?.account?.login ?? null,
          server: live?.account?.server ?? null,
          openPositionsCount: Array.isArray(live?.positions) ? live.positions.length : null,
        } : null;
        const list: any[] = Array.isArray(live?.positions) ? live.positions : [];
        positionsSnapshot = list;
        const match = list.find((p: any) => {
          const pSym = String(p?.symbol ?? "").toUpperCase();
          const pSide = String(p?.side ?? "").toLowerCase();
          const pVol = Number(p?.volume ?? 0);
          return pSym === wantSym && pSide === wantSide && Math.abs(pVol - wantVol) < 1e-6;
        });
        if (match) {
          confirmedPosition = match;
          confirmedTicket = match.ticket != null ? String(match.ticket) : null;
          mt5Confirmed = true;
          break;
        }
      } catch { /* ignore reconciliation errors */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Final lifecycle determination
  // ---------------------------------------------------------------------------
  const brokerAccepted = upstreamSuccess || retcodeFilled || retcodeAccepted || isPlacedOnly;
  const liveOrderSent = brokerAccepted;

  let success: boolean;
  let status: string;
  let outcome: string;
  let step: string;
  let classification: string;
  let brokerMessage = brokerMessageRaw;

  if (mt5Confirmed) {
    success = true;
    status = "position_confirmed";
    outcome = "success";
    step = "execution_result";
    classification = "placed_confirmed";
    brokerMessage = `Position confirmed in MT5. Ticket: ${confirmedTicket}`;
  } else if (isBlocked) {
    success = false;
    status = "blocked";
    outcome = "blocked";
    step = "pretrade_validation";
    classification = "blocked";
  } else if (brokerAccepted) {
    // Broker accepted (10008 / placed / success-but-no-fill) but MT5
    // reconciliation could not find a matching live position.
    success = false;
    status = "execution_unconfirmed";
    outcome = "broker_accepted_no_position";
    step = "execution_unconfirmed";
    classification = "placed_unconfirmed";
    brokerMessage = "Broker accepted the order, but no MT5 position was confirmed.";
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

  // Diagnostic block (always included; surfaced in Dev Mode by the UI).
  const diagnostics = {
    payloadSent: {
      tradeId, symbol, side, orderType, volume: Number(volume),
      stopLoss, takeProfit,
    },
    rawTradingLayerResponse: res,
    retcode: retcodeNum,
    retcodeDescription:
      res.retcodeDescription ?? res.retcode_description ?? brokerMessageRaw ?? null,
    orderId: res.orderId ?? res.order_id ?? res.order ?? null,
    dealId: res.dealId ?? res.deal_id ?? res.deal ?? null,
    positionTicket: confirmedTicket ?? (res.ticket != null ? String(res.ticket) : null),
    accountId: liveAcctDiag?.accountId ?? null,
    login: liveAcctDiag?.login ?? null,
    server: liveAcctDiag?.server ?? null,
    reconciliationAttempts,
    livePositionsCountAtReconcile: liveAcctDiag?.openPositionsCount ?? null,
  };

  const confirmedEntryPrice = extractEntryPrice(confirmedPosition);
  const executedPriceFinal = mt5Confirmed
    ? (confirmedEntryPrice ?? (executedPrice != null ? Number(executedPrice) : null))
    : (executedPrice != null ? Number(executedPrice) : null);

  // Best-effort audit insert — never block the response.
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (uid) {
      await supabase.from("execution_audit_events").insert({
        user_id: uid,
        trade_id: tradeId ?? null,
        symbol,
        side,
        volume: Number(volume),
        status,
        outcome,
        requested_price: requestedPrice,
        executed_price: executedPriceFinal,
        slippage,
        latency_ms: Math.round(totalLatencyMs),
        spread,
        bid: requestedBid,
        ask: requestedAsk,
        broker_message: classification === "placed_unconfirmed"
          ? "Broker accepted order but no matching MT5 position was found."
          : brokerMessage,
        retcode: retcodeNum,
        reason: outcome === "blocked" || outcome === "rejected"
          ? (res.error || reasonsText || brokerMessage || null)
          : null,
        rule_violated: outcome === "blocked" ? (res.ruleViolated || reasonsText || res.error || null) : null,
        ticket: confirmedTicket ?? (res.ticket != null ? String(res.ticket) : null),
        raw: {
          ...(res && typeof res === "object" ? res : {}),
          classification,
          version: VERSION,
          step,
          liveOrderSent,
          brokerAccepted,
          mt5Confirmed,
          confirmationStatus: mt5Confirmed
            ? "confirmed"
            : (brokerAccepted ? "not_found" : "failed"),
          confirmedTicket,
          confirmedEntryPrice,
          confirmedVolume: confirmedPosition?.volume ?? null,
          reconciliationAttempts,
          quote_bid: requestedBid,
          quote_ask: requestedAsk,
          quote_spread: spread,
          quote_timestamp: quoteTimestamp,
          quote_source: quoteSource,
          diagnostics,
        },
      });
    }
  } catch { /* swallow audit errors */ }

  return json({
    success,
    version: VERSION,
    step,
    liveOrderSent,
    brokerAccepted,
    mt5Confirmed,
    confirmationStatus: mt5Confirmed
      ? "confirmed"
      : (brokerAccepted ? "not_found" : "failed"),
    confirmedTicket,
    confirmedEntryPrice,
    confirmedVolume: confirmedPosition?.volume ?? null,
    tradeId,
    status,
    outcome,
    classification,
    requestedPrice,
    executedPrice: executedPriceFinal,
    slippage,
    latencyMs: totalLatencyMs,
    clientLatencyMs,
    serverLatencyMs,
    spread,
    bid: requestedBid,
    ask: requestedAsk,
    brokerMessage,
    ticket: confirmedTicket ?? (res.ticket ?? null),
    retcode: retcodeNum,
    error: success ? null : (
      classification === "placed_unconfirmed"
        ? "Broker accepted order but no matching MT5 position was found."
        : (res.error || brokerMessage || "Order rejected")
    ),
    reasons: res.reasons ?? null,
    diagnostics,
  });
});

