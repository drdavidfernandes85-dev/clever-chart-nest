// ping-trading-layer
// Diagnostic endpoint. Verifies reachability of Trading Layer API.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRADING_LAYER_BASE = "https://api.trading-layer.com";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: unknown = null;
  try { body = await req.json(); } catch { /* ignore */ }

  const apiKey = Deno.env.get("TRADING_LAYER_API_KEY");

  let reachable: boolean | null = null;
  let status: number | null = null;
  let errorMsg: string | null = null;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${TRADING_LAYER_BASE}/health`, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    status = res.status;
    reachable = res.ok;
    if (!res.ok) errorMsg = (await res.text()).slice(0, 300);
  } catch (e) {
    reachable = false;
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  return json(200, {
    success: true,
    pong: true,
    received: body,
    env: {
      has_trading_layer_api_key: Boolean(apiKey),
      supabase_url_present: Boolean(Deno.env.get("SUPABASE_URL")),
    },
    trading_layer: {
      base_url: TRADING_LAYER_BASE,
      reachable,
      status,
      error: errorMsg,
    },
    timestamp: new Date().toISOString(),
  });
});
