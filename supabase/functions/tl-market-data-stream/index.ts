// tl-market-data-stream
// ----------------------
// WebSocket proxy between the browser and the Trading Layer market-data
// WebSocket. The Trading Layer API key never leaves the server.
//
// Client opens:
//   wss://<project>.functions.supabase.co/tl-market-data-stream
//     ?accountId=<TL accountId>&token=<supabase JWT>
//
// We:
//   1. Verify the Supabase JWT.
//   2. Confirm the caller owns `metaapi_account_id = accountId` in
//      `user_mt_accounts`.
//   3. Open upstream wss://api.trading-layer.com/api/v1/accounts/{id}/market-data/ws
//      with Authorization: Bearer <TRADING_LAYER_API_KEY>.
//   4. Pipe frames in both directions.
//
// This function only proxies *market data*. It does not touch execution,
// risk checks, reconciliation, or any other Trading Layer endpoint.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TL_BASE_WS = "wss://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Expected WebSocket upgrade",
      }),
      { status: 426, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!TRADING_LAYER_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") || "";
  const token = url.searchParams.get("token") || "";
  if (!accountId || !token) {
    return new Response("Missing accountId or token", { status: 400 });
  }

  // ---- Authenticate user ----
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = userData.user.id;

  // ---- Confirm ownership ----
  const { data: ownRow, error: ownErr } = await admin
    .from("user_mt_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("metaapi_account_id", accountId)
    .maybeSingle();
  if (ownErr || !ownRow) {
    return new Response("Forbidden", { status: 403 });
  }

  // ---- Upgrade client socket ----
  const { socket: client, response } = Deno.upgradeWebSocket(req);

  // ---- Open upstream TL socket ----
  // The Trading Layer API key never leaves the server. Deno's standard
  // WebSocket does not accept custom HTTP headers, so we send the bearer
  // token via the Sec-WebSocket-Protocol subprotocol (the standard
  // browser/Deno-compatible auth carrier). Pending TL confirmation of
  // their accepted WS auth scheme.
  const upstreamUrl =
    `${TL_BASE_WS}/api/v1/accounts/${encodeURIComponent(accountId)}/market-data/ws`;
  let upstream: WebSocket | null = null;
  try {
    upstream = new WebSocket(upstreamUrl, [
      `bearer.${TRADING_LAYER_KEY}`,
    ]);
  } catch (e) {
    console.error("tl-market-data-stream: upstream connect failed");
    try { client.close(1011, "upstream connect failed"); } catch { /* */ }
    return response;
  }

  const closeBoth = (code = 1000, reason = "") => {
    try { upstream?.close(code, reason); } catch { /* */ }
    try { client.close(code, reason); } catch { /* */ }
  };

  upstream.onopen = () => {
    try { client.send(JSON.stringify({ type: "proxy_ready" })); } catch { /* */ }
  };
  upstream.onmessage = (ev) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(ev.data); } catch { /* */ }
    }
  };
  upstream.onerror = (e) => {
    console.error("tl-market-data-stream upstream error");
    try { client.send(JSON.stringify({ type: "error", message: "upstream error" })); } catch { /* */ }
  };
  upstream.onclose = (e) => {
    closeBoth(e.code || 1011, e.reason || "upstream closed");
  };

  client.onmessage = (ev) => {
    if (upstream && upstream.readyState === WebSocket.OPEN) {
      try { upstream.send(ev.data); } catch { /* */ }
    }
  };
  client.onerror = () => {
    closeBoth(1011, "client error");
  };
  client.onclose = () => {
    closeBoth(1000, "client closed");
  };

  return response;
});
