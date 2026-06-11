import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function timedFetch(url: string, init: RequestInit, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...init, signal: ac.signal }); } finally { clearTimeout(t); }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return new Response("unauth", { status: 401, headers: cors });
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return new Response("not_admin", { status: 403, headers: cors });
  const KEY = Deno.env.get("TRADING_LAYER_API_KEY")!;
  const ACC = "29008868-d583-4ab5-a6c1-57586fe92007";
  const BASE = "https://api.trading-layer.com";
  const dateFrom = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const attempts = [
    `rates?symbol=EURUSD&timeframe=M1&dateFrom=${encodeURIComponent(dateFrom)}&count=8`,
    `rates?symbol=EURUSD&timeframe=M5&startPos=0&count=4`,
  ];
  const ratesResults: any[] = [];
  for (const q of attempts) {
    try {
      const r = await timedFetch(`${BASE}/api/v1/accounts/${ACC}/${q}`, { headers: { Authorization: `Bearer ${KEY}` } }, 60000);
      const txt = await r.text();
      ratesResults.push({ q, status: r.status, body: txt.slice(0, 1500) });
    } catch (e) {
      ratesResults.push({ q, status: "EXC", body: String(e).slice(0, 300) });
    }
  }
  let tick: any;
  try {
    const rTick = await timedFetch(`${BASE}/api/v1/accounts/${ACC}/symbols/EURUSD/tick`, { headers: { Authorization: `Bearer ${KEY}` } }, 5000);
    tick = { status: rTick.status, body: (await rTick.text()).slice(0, 400) };
  } catch (e) { tick = { status: "EXC", body: String(e) }; }
  return new Response(JSON.stringify({
    serverNow: new Date().toISOString(),
    serverNowMs: Date.now(),
    rates: ratesResults,
    tick,
  }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
