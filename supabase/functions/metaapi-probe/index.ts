// One-shot admin probe for MetaAPI provider verification + A3 conventions capture.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const TOKEN = Deno.env.get("METAAPI_TOKEN") ?? "";
const ACC = "077d6ed8-f601-47f8-badc-67b7d38dd40e";
const REGION = "london"; // confirmed by provisioning probe

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

  const prov = `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${ACC}`;
  const list = `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts`;

  // Historical market data — regional endpoint.
  const mdBase = `https://mt-market-data-client-api-v1.${REGION}.agiliumtrade.ai/users/current/accounts/${ACC}`;
  const candlesXAU = `${mdBase}/historical-market-data/symbols/XAUUSD/timeframes/1m/candles?limit=10`;
  // Live spec / current price via client-api regional endpoint.
  const clientBase = `https://mt-client-api-v1.${REGION}.agiliumtrade.ai/users/current/accounts/${ACC}`;
  const xauPrice = `${clientBase}/symbols/XAUUSD/current-price`;
  const xauSpec  = `${clientBase}/symbols/XAUUSD/specification`;

  const results = {
    wall_clock_utc: new Date().toISOString(),
    token_meta: { length: TOKEN.length, prefix: TOKEN.slice(0, 8) + "…" },
    target_account_lookup: await call(prov),
    accounts_under_token: await call(list),
    xauusd_current_price: await call(xauPrice),
    xauusd_specification: await call(xauSpec),
    xauusd_m1_last10:    await call(candlesXAU),
  };

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
