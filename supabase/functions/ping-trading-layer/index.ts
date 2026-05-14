// ping-trading-layer
// Temporary diagnostic endpoint. Echoes the request body and reports whether
// METAAPI_TOKEN is configured, plus a simple reachability check to MetaApi.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: unknown = null;
  try { body = await req.json(); } catch { /* ignore */ }

  const metaToken = Deno.env.get("METAAPI_TOKEN");
  let metaapiReachable: boolean | null = null;
  let metaapiStatus: number | null = null;
  let metaapiError: string | null = null;

  if (metaToken) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(
        "https://mt-provisioning-profile-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts?limit=1",
        { headers: { "auth-token": metaToken, Accept: "application/json" }, signal: ctrl.signal },
      );
      clearTimeout(t);
      metaapiStatus = res.status;
      metaapiReachable = res.ok;
      if (!res.ok) {
        metaapiError = (await res.text()).slice(0, 300);
      }
    } catch (e) {
      metaapiReachable = false;
      metaapiError = e instanceof Error ? e.message : String(e);
    }
  }

  return json(200, {
    success: true,
    pong: true,
    received: body,
    env: {
      has_metaapi_token: Boolean(metaToken),
      supabase_url_present: Boolean(Deno.env.get("SUPABASE_URL")),
    },
    metaapi: {
      reachable: metaapiReachable,
      status: metaapiStatus,
      error: metaapiError,
    },
    timestamp: new Date().toISOString(),
  });
});
