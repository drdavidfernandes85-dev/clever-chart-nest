// execute-signal: send a trading-room signal to the user's MT5 account via Trading Layer
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TL_BASE = "https://api.trading-layer.com/api/v1";

interface Body {
  signalId?: string;
  symbol?: string;
  side?: string;
  volume?: number;
  stopLoss?: number;
  takeProfit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const TRADING_LAYER_API_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!TRADING_LAYER_API_KEY) return json(500, { success: false, error: "Trading Layer API key not configured." });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { success: false, error: "Missing Authorization header." });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json(401, { success: false, error: "Not authenticated." });
  const userId = userData.user.id;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "Invalid JSON body." });
  }

  const { signalId, symbol, side, volume, stopLoss, takeProfit } = body;

  // Validation
  if (!symbol || typeof symbol !== "string") {
    return json(400, { success: false, error: "symbol is required." });
  }
  if (side !== "buy" && side !== "sell") {
    return json(400, { success: false, error: "side must be 'buy' or 'sell'." });
  }
  if (typeof volume !== "number" || !Number.isFinite(volume) || volume <= 0) {
    return json(400, { success: false, error: "volume must be a positive number." });
  }

  // Latest connected MT account
  const { data: account, error: accErr } = await supabase
    .from("user_mt_accounts")
    .select("id, login, server_name, status, trading_layer_trader_id, created_at")
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accErr) return json(500, { success: false, error: accErr.message });
  if (!account) return json(200, { success: false, error: "No connected trading account found." });
  const traderId = account.trading_layer_trader_id;
  if (!traderId) return json(200, { success: false, error: "Connected account is missing a Trading Layer trader id." });

  const requestPayload = {
    side,
    symbol,
    volume,
    stopLoss,
    takeProfit,
    deviation: 20,
  };

  const idempotencyKey = `signal-${signalId ?? "manual"}-${userId}`;

  let httpStatus = 0;
  let respJson: any = null;
  let networkError: string | null = null;

  try {
    const res = await fetch(`${TL_BASE}/accounts/${encodeURIComponent(traderId)}/trades/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TRADING_LAYER_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(requestPayload),
    });
    httpStatus = res.status;
    respJson = await res.json().catch(() => ({}));
  } catch (e) {
    networkError = e instanceof Error ? e.message : String(e);
  }

  const classification: string | undefined = respJson?.data?.classification;
  const retcode: number | undefined = respJson?.data?.retcode;
  const retcode_description: string | undefined =
    respJson?.data?.retcode_description ?? respJson?.data?.retcodeDescription;
  const comment: string | undefined = respJson?.data?.comment;
  const ticket: string | undefined =
    respJson?.data?.ticket?.toString?.() ?? respJson?.data?.order?.toString?.();

  let success = false;
  let status = "rejected";
  let errorMessage: string | null = networkError;

  if (!networkError) {
    switch (classification) {
      case "done":
        success = true;
        status = "filled";
        break;
      case "placed":
        success = true;
        status = "placed";
        break;
      case "partial":
        success = true;
        status = "partial";
        break;
      case "rejected":
        success = false;
        status = "rejected";
        errorMessage = retcode_description || comment || "Trade rejected by Trading Layer.";
        break;
      default:
        success = false;
        status = "unknown";
        errorMessage =
          retcode_description ||
          comment ||
          respJson?.message ||
          `Unexpected Trading Layer response (HTTP ${httpStatus}).`;
    }
  }

  // Audit log (use service-role client so insert always lands)
  await admin.from("trade_execution_logs").insert({
    user_id: userId,
    account_id: account.id,
    signal_id: signalId ?? null,
    symbol,
    side,
    volume,
    stop_loss: stopLoss ?? null,
    take_profit: takeProfit ?? null,
    status,
    classification: classification ?? null,
    retcode: retcode ?? null,
    retcode_description: retcode_description ?? null,
    comment: comment ?? null,
    ticket: ticket ?? null,
    http_status: httpStatus || null,
    request_payload: requestPayload,
    response_payload: respJson,
    error_message: errorMessage,
  });

  if (success) {
    return json(200, {
      success: true,
      status,
      classification,
      ticket,
      tradingLayerStatus: httpStatus,
      tradingLayerResponse: respJson,
    });
  }

  return json(200, {
    success: false,
    status,
    classification,
    error: errorMessage || "Trade execution failed.",
    retcode,
    retcode_description,
    comment,
    tradingLayerStatus: httpStatus,
    tradingLayerResponse: respJson,
  });
});
