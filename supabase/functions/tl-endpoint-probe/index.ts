// Probe the discovered /rates endpoint live to confirm it returns data.
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
  const tfs = ["M1", "1", 1, "M5", "5", "H1", "60"];
  const out: any[] = [];
  for (const tf of tfs) {
    const url = `${BASE}/api/v1/accounts/${ACC}/rates?symbol=EURUSD&timeframe=${tf}&count=5`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
    const txt = await r.text();
    out.push({ tf, status: r.status, body: txt.slice(0, 600) });
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
