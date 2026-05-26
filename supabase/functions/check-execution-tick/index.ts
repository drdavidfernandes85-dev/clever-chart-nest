// check-execution-tick — read-only diagnostic for pre-trade fresh-tick.
//
// Uses the SAME server-side authoritative tick resolver as
// submit-best-execution-order. NEVER submits an order.
//
// Body: { symbol: string, brokerSymbol?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  resolveFreshExecutionTick,
  FRESH_TICK_POLICY_VERSION,
} from "../_shared/freshTick.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Missing Authorization" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const displaySymbol = String(body?.symbol || "").trim().toUpperCase();
  const brokerSymbol = String(body?.brokerSymbol || displaySymbol || "").trim().toUpperCase();

  if (!displaySymbol) return json({ success: false, error: "symbol is required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return json({ success: false, error: "Unauthorized" }, 401);

  const { data: acct } = await supabase
    .from("user_mt_accounts")
    .select("trading_layer_account_id")
    .eq("user_id", uid)
    .eq("platform", "mt5")
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const routeAccountId = (acct as any)?.trading_layer_account_id ?? null;

  const result = await resolveFreshExecutionTick({
    routeAccountId,
    brokerSymbol,
    displaySymbol,
  });

  return json({
    success: true,
    checkedAt: new Date().toISOString(),
    policyVersion: FRESH_TICK_POLICY_VERSION,
    displaySymbol,
    brokerSymbol: result.brokerSymbol,
    routeAccountIdMasked: result.routeAccountIdMasked,
    routeAvailable: !!routeAccountId,
    fresh: result.fresh,
    code: result.code,
    message: result.message,
    bid: result.bid,
    ask: result.ask,
    spread: result.spread,
    timestamp: result.timestamp,
    ageMs: result.ageMs,
    thresholdMs: result.thresholdMs,
    source: result.source,
    upstreamStatus: result.upstreamStatus,
  });
});
