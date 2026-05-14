// trading-layer-health
// Diagnostic endpoint. Verifies Trading Layer tenant endpoint.

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

  let upstreamRes: Response | null = null;
  let upstreamJson: any = null;
  let upstreamError: string | null = null;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    upstreamRes = await fetch(`${TRADING_LAYER_BASE}/api/v1/tenant`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);

    const text = await upstreamRes.text();
    try { upstreamJson = JSON.parse(text); } catch { upstreamJson = { raw: text }; }
  } catch (e) {
    upstreamError = e instanceof Error ? e.message : String(e);
  }

  const status = upstreamRes?.status ?? null;
  const isHttpError = status === 404 || status === 401 || status === 403 || status === 500;

  // If Trading Layer returned an error HTTP status, treat as error
  if (!upstreamRes || !upstreamRes.ok || isHttpError) {
    return json(200, {
      success: false,
      error: upstreamError || `Upstream returned HTTP ${status}`,
      upstream_status: status,
      upstream: upstreamJson,
      env: {
        has_trading_layer_api_key: Boolean(apiKey),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Forward Trading Layer response as-is, adding our envelope
  return json(200, {
    success: true,
    ...upstreamJson,
    _meta: {
      received: body,
      env: {
        has_trading_layer_api_key: Boolean(apiKey),
      },
      timestamp: new Date().toISOString(),
    },
  });
});
