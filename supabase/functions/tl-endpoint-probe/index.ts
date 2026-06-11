// Probe /rates with a clean param set so we can read the real body shape.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
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

  const dateFrom = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const ratesUrl = `${BASE}/api/v1/accounts/${ACC}/rates?symbol=EURUSD&timeframe=M1&dateFrom=${encodeURIComponent(dateFrom)}&count=8`;
  const rRates = await fetch(ratesUrl, { headers: { Authorization: `Bearer ${KEY}` } });
  const ratesBody = await rRates.text();

  const tickUrl = `${BASE}/api/v1/accounts/${ACC}/symbols/EURUSD/tick`;
  const rTick = await fetch(tickUrl, { headers: { Authorization: `Bearer ${KEY}` } });
  const tickBody = await rTick.text();

  return new Response(JSON.stringify({
    serverNow: new Date().toISOString(),
    serverNowMs: Date.now(),
    rates: { status: rRates.status, body: ratesBody },
    tick: { status: rTick.status, body: tickBody },
  }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
