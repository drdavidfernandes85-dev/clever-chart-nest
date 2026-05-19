// Best-Execution Order Router
// Wraps execute-trade with pre-trade quote snapshot + latency/slippage metrics.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "BEST_EXEC_LIVE_CONTROLLED_V1_2026_05_19";

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

  // Pre-trade quote snapshot for slippage measurement (best-effort).
  let requestedBid: number | null = null;
  let requestedAsk: number | null = null;
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
    }
  } catch { /* ignore — quote snapshot is best-effort */ }

  const requestedPrice =
    side === "buy" ? requestedAsk : side === "sell" ? requestedBid : null;

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
  const brokerMessage =
    res.brokerMessage ??
    res.retcodeDescription ??
    res.retcode_description ??
    res.message ??
    res.error ??
    null;

  const success = res.success === true;
  const status = res.status ?? res.classification ?? (success ? "done" : "failed");
  const outcome = success
    ? "success"
    : (String(status).toLowerCase() === "blocked" || res.blocked === true || (Array.isArray(res.reasons) && res.reasons.length > 0 && res.retcode == null))
      ? "blocked"
      : "rejected";
  const spread =
    requestedBid != null && requestedAsk != null
      ? Math.max(0, requestedAsk - requestedBid)
      : null;
  const reasonsText = Array.isArray(res.reasons) ? res.reasons.join(" · ") : null;

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
        executed_price: executedPrice != null ? Number(executedPrice) : null,
        slippage,
        latency_ms: Math.round(totalLatencyMs),
        spread,
        bid: requestedBid,
        ask: requestedAsk,
        broker_message: brokerMessage,
        retcode: res.retcode != null ? Number(res.retcode) : null,
        reason: outcome !== "success" ? (res.error || reasonsText || brokerMessage || null) : null,
        rule_violated: outcome === "blocked" ? (res.ruleViolated || reasonsText || res.error || null) : null,
        ticket: res.ticket != null ? String(res.ticket) : null,
        raw: res,
      });
    }
  } catch { /* swallow audit errors */ }

  return json({
    success,
    version: VERSION,
    step: success ? "execution_result" : "pretrade_validation",
    liveOrderSent: success,
    tradeId,
    status,
    outcome,
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
    ticket: res.ticket ?? null,
    retcode: res.retcode ?? null,
    error: success ? null : (res.error || brokerMessage || "Order rejected"),
    reasons: res.reasons ?? null,
  });
});
