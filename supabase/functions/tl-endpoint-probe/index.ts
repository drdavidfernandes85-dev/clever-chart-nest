// Admin-only one-shot probe of Trading Layer endpoints for historical candles.
// Read-only. No mutations. Temporary investigative tool — to be deleted after 4(a).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: cors });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: cors });
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return new Response(JSON.stringify({ error: "not_admin" }), { status: 403, headers: cors });

  const KEY = Deno.env.get("TRADING_LAYER_API_KEY")!;
  const ACC = "29008868-d583-4ab5-a6c1-57586fe92007";
  const SYM = "EURUSD";
  const BASE = "https://api.trading-layer.com";
  const paths = [
    `/api/v1/accounts/${ACC}/symbols/${SYM}/candles?timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/candles`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/bars?timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/bars`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/rates?timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/rates`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/ohlc?timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/ohlc`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/history?timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/symbols/${SYM}/history/rates?timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/history/rates?symbol=${SYM}&timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/candles?symbol=${SYM}&timeframe=M1&limit=10`,
    `/api/v1/accounts/${ACC}/bars?symbol=${SYM}&timeframe=M1&limit=10`,
    `/api/v1/candles?accountId=${ACC}&symbol=${SYM}&timeframe=M1&limit=10`,
    `/api/v1/bars?accountId=${ACC}&symbol=${SYM}&timeframe=M1&limit=10`,
    `/api/v1/openapi.json`,
    `/openapi.json`,
    `/swagger`,
    `/swagger.json`,
    `/api/docs`,
    `/docs`,
    `/api/v1/docs`,
  ];
  const out: any[] = [];
  for (const p of paths) {
    try {
      const r = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${KEY}` } });
      const txt = await r.text();
      out.push({ path: p, status: r.status, len: txt.length, snippet: txt.slice(0, 200).replace(/\s+/g, " ") });
    } catch (e) {
      out.push({ path: p, status: "ERR", error: String(e).slice(0, 120) });
    }
  }
  return new Response(JSON.stringify({ results: out }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
