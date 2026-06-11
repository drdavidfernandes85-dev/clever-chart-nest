// Admin-gated read-only probe. Stays alive until 4(a) ships, then deleted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function timed(url: string, init: RequestInit, ms = 12000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
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
  const dateTo = new Date().toISOString();
  const histFrom = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const paths = [
    // A3 retry
    `/api/v1/accounts/${ACC}/rates?symbol=EURUSD&timeframe=M1&dateFrom=${encodeURIComponent(dateFrom)}&count=4`,
    // open positions (raw, unfiltered) — for Part A divergence trace
    `/api/v1/accounts/${ACC}/positions`,
    // pending orders
    `/api/v1/accounts/${ACC}/orders`,
    `/api/v1/accounts/${ACC}/orders?limit=10`,
    // history
    `/api/v1/accounts/${ACC}/history/orders?dateFrom=${encodeURIComponent(histFrom)}&dateTo=${encodeURIComponent(dateTo)}&limit=5`,
    `/api/v1/accounts/${ACC}/history/deals?dateFrom=${encodeURIComponent(histFrom)}&dateTo=${encodeURIComponent(dateTo)}&limit=5`,
    // symbol spec — confirm tick_value_profit/loss are present in the raw payload
    `/api/v1/accounts/${ACC}/symbols/EURUSD`,
  ];
  const out: any[] = [];
  for (const p of paths) {
    try {
      const r = await timed(`${BASE}${p}`, { headers: { Authorization: `Bearer ${KEY}` } });
      const txt = await r.text();
      out.push({ p, status: r.status, body: txt.slice(0, 2500) });
    } catch (e) {
      out.push({ p, status: "EXC", body: String(e).slice(0, 300) });
    }
  }
  return new Response(JSON.stringify({ serverNow: new Date().toISOString(), results: out }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
