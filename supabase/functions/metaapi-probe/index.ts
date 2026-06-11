// One-shot admin probe for MetaAPI provider verification (Item 0).
// GET ?step=all → runs provisioning state, account info, current price, candles.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const TOKEN = Deno.env.get("METAAPI_TOKEN") ?? "";
const ACC = "29008868-d583-4ab5-a6c1-57586fe92007";
const REGION = "new-york";

async function call(url: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { "auth-token": TOKEN, "Content-Type": "application/json" } });
    const txt = await r.text();
    let body: unknown = txt;
    try { body = JSON.parse(txt); } catch { /* leave as text */ }
    return { url, status: r.status, ms: Date.now() - t0, body };
  } catch (e) {
    return { url, status: 0, ms: Date.now() - t0, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "METAAPI_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provisioning = `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${ACC}`;
  const clientBase = `https://mt-client-api-v1.${REGION}.agiliumtrade.ai/users/current/accounts/${ACC}`;
  const mdBase = `https://mt-market-data-client-api-v1.${REGION}.agiliumtrade.ai/users/current/accounts/${ACC}`;

  const results = {
    token_meta: { length: TOKEN.length, prefix: TOKEN.slice(0, 8) + "…" },
    wall_clock_utc: new Date().toISOString(),
    provisioning_state: await call(provisioning),
    account_information: await call(`${clientBase}/accountInformation`),
    current_price_xauusd: await call(`${clientBase}/symbols/XAUUSD/current-price?keepSubscription=false`),
    candles_xauusd_m1_last10: await call(`${mdBase}/historical-market-data/symbols/XAUUSD/timeframes/1m/candles?limit=10`),
    positions: await call(`${clientBase}/positions`),
  };

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
