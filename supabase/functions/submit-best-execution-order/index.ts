// Best-Execution Order Router
// Wraps execute-trade with pre-trade quote snapshot + latency/slippage metrics.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
  return json({
    success,
    tradeId,
    status: res.status ?? res.classification ?? (success ? "done" : "failed"),
    requestedPrice,
    executedPrice: executedPrice != null ? Number(executedPrice) : null,
    slippage,
    latencyMs: totalLatencyMs,
    clientLatencyMs,
    serverLatencyMs,
    brokerMessage,
    ticket: res.ticket ?? null,
    retcode: res.retcode ?? null,
    error: success ? null : (res.error || brokerMessage || "Order rejected"),
    reasons: res.reasons ?? null,
    raw: res,
  });
});
