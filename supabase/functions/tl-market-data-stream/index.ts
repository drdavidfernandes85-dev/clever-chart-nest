// tl-market-data-stream
// ----------------------
// WebSocket proxy between the browser and the Trading Layer market-data
// WebSocket. The Trading Layer API key never leaves the server.
//
// Auth (confirmed by Trading Layer):
//   The upstream WS accepts the API key via the Sec-WebSocket-Protocol
//   subprotocol fallback in the exact form:
//     new WebSocket(url, ["bearer", "tl_live_..."])
//   The key MUST include the `mt5:market-data` scope.
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
//      using subprotocol bearer auth.
//   4. Pipe frames in both directions.
//
// This function only proxies *market data*. It does not touch execution,
// risk checks, reconciliation, or any other Trading Layer endpoint.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Trading Layer key used for the market-data WebSocket must include the
// `mt5:market-data` scope. Prefer the explicit env name, fall back to the
// existing project secret name for backwards compatibility.
const TRADING_LAYER_KEY =
  Deno.env.get("TRADING_LAYER_PUBLIC_API_KEY") ||
  Deno.env.get("TRADING_LAYER_API_KEY") ||
  "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TL_BASE_WS = "wss://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const maskAccountId = (id: string) =>
  !id ? "" : id.length <= 6 ? "***" : `${id.slice(0, 3)}…${id.slice(-3)}`;

function logEvent(stage: string, errorCode: string | null, extra: Record<string, unknown> = {}) {
  // Never log keys, tokens, subprotocol values or full upstream URLs.
  try {
    console.log(
      JSON.stringify({
        fn: "tl-market-data-stream",
        ts: new Date().toISOString(),
        stage,
        errorCode,
        ...extra,
      }),
    );
  } catch {
    /* noop */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response(
      JSON.stringify({ success: false, error: "Expected WebSocket upgrade" }),
      { status: 426, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // --- Validate TL key presence + prefix (no value logged) ---
  if (!TRADING_LAYER_KEY) {
    logEvent("config", "TL_CONFIG_MISSING", { reason: "no_key" });
    return new Response(
      JSON.stringify({ success: false, errorCode: "TL_CONFIG_MISSING" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!/^tl_(live|test)_/.test(TRADING_LAYER_KEY)) {
    logEvent("config", "TL_CONFIG_MISSING", { reason: "bad_prefix" });
    return new Response(
      JSON.stringify({ success: false, errorCode: "TL_CONFIG_MISSING" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logEvent("config", "TL_CONFIG_MISSING", { reason: "supabase_env" });
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
    logEvent("auth", "UNAUTHORIZED");
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = userData.user.id;

  // ---- Confirm ownership ----
  const { data: ownRow, error: ownErr } = await admin
    .from("user_mt_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("trading_layer_trader_id", accountId)
    .maybeSingle();
  if (ownErr || !ownRow) {
    logEvent("auth", "FORBIDDEN", { accountId: maskAccountId(accountId) });
    return new Response("Forbidden", { status: 403 });
  }

  // ---- Upgrade client socket ----
  const { socket: client, response } = Deno.upgradeWebSocket(req);

  // ---- Open upstream TL socket ----
  // Confirmed auth: Sec-WebSocket-Protocol subprotocol fallback
  //   new WebSocket(url, ["bearer", tlApiKey])
  // The key must include the `mt5:market-data` scope.
  const upstreamUrl =
    `${TL_BASE_WS}/api/v1/accounts/${encodeURIComponent(accountId)}/market-data/ws`;
  let upstream: WebSocket | null = null;
  try {
    upstream = new WebSocket(upstreamUrl, ["bearer", TRADING_LAYER_KEY]);
  } catch {
    logEvent("upstream_connect", "TL_WS_CONNECT_FAILED", {
      accountId: maskAccountId(accountId),
    });
    try {
      client.send(JSON.stringify({ type: "proxy_error", errorCode: "TL_WS_CONNECT_FAILED" }));
      client.close(1011, "upstream connect failed");
    } catch { /* */ }
    return response;
  }

  const closeBoth = (code = 1000, reason = "") => {
    try { upstream?.close(code, reason); } catch { /* */ }
    try { client.close(code, reason); } catch { /* */ }
  };

  upstream.onopen = () => {
    logEvent("upstream_open", null, { accountId: maskAccountId(accountId) });
    try {
      client.send(
        JSON.stringify({
          type: "proxy_ready",
          authMethod: "subprotocol_bearer",
          requiredScope: "mt5:market-data",
        }),
      );
    } catch { /* */ }
  };

  // Buffer any subscribe/control messages the client sends before Trading
  // Layer emits `connection.ready`. Replay them once ready arrives.
  let upstreamReady = false;
  const pendingClientFrames: string[] = [];

  upstream.onmessage = (ev) => {
    // Detect `connection.ready` and forward it to the client, then flush
    // any buffered client frames upstream.
    if (!upstreamReady && typeof ev.data === "string") {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed && parsed.type === "connection.ready") {
          upstreamReady = true;
          logEvent("upstream_ready", null, {
            accountId: maskAccountId(accountId),
          });
          // flush buffered frames
          for (const f of pendingClientFrames.splice(0)) {
            try { upstream!.send(f); } catch { /* */ }
          }
        }
      } catch { /* not JSON — just forward */ }
    }
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(ev.data); } catch { /* */ }
    }
  };
  upstream.onerror = () => {
    // Never log the raw error body (may include credentials/echoed headers).
    logEvent("upstream_error", "TL_WS_UPSTREAM_ERROR", {
      accountId: maskAccountId(accountId),
    });
    try {
      client.send(JSON.stringify({ type: "proxy_error", errorCode: "TL_WS_UPSTREAM_ERROR" }));
    } catch { /* */ }
  };
  upstream.onclose = (e) => {
    // 4401/1008/4403 commonly indicate auth/scope failure.
    const code = e.code || 1011;
    const isAuth = code === 4401 || code === 4403 || code === 1008;
    const errorCode = isAuth ? "TL_WS_AUTH_FAILED" : null;
    logEvent("upstream_close", errorCode, {
      code,
      accountId: maskAccountId(accountId),
    });
    if (isAuth) {
      try {
        client.send(
          JSON.stringify({
            type: "proxy_error",
            errorCode: "TL_WS_AUTH_FAILED",
            message:
              "Trading Layer WebSocket authentication failed. Confirm the API key includes mt5:market-data scope.",
          }),
        );
      } catch { /* */ }
    }
    closeBoth(code, "");
  };

  client.onmessage = (ev) => {
    if (!upstream) return;
    const data = typeof ev.data === "string" ? ev.data : "";
    if (!upstreamReady) {
      // Buffer until Trading Layer emits connection.ready.
      if (data) pendingClientFrames.push(data);
      return;
    }
    if (upstream.readyState === WebSocket.OPEN) {
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
