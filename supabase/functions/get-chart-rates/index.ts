// get-chart-rates — authenticated read-only seam consumer.
// Returns { bars, source, served_ms, fellBackFromTradingLayer, fallbackReason? }.
// METAAPI_TOKEN never leaves the function. Per-user simple rate limit.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { getCandles, type Timeframe, PROVIDER_LIMITS } from "../_shared/marketHistory.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_TF: Timeframe[] = ["1m","5m","15m","30m","1h","4h","1d"];

// Simple per-user token bucket (instance-local; resets on cold start).
// Budget: 30 requests / 60s per user. Upstream-cost amplifier.
const buckets = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
function rateLimit(userId: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || b.resetAt < now) {
    buckets.set(userId, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true };
  }
  if (b.count >= RL_MAX) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count += 1;
  return { ok: true };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Auth — verify caller via JWT claims.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const userId = claimsData.claims.sub as string;

  // Rate limit per user.
  const rl = rateLimit(userId);
  if (!rl.ok) return json({ error: "rate_limited", retryAfter: rl.retryAfter }, 429);

  // Parse + validate body.
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const symbol = String(body?.symbol ?? "").trim().toUpperCase();
  const timeframe = String(body?.timeframe ?? "1m") as Timeframe;
  const limit = Math.max(1, Math.min(Number(body?.limit ?? 500), PROVIDER_LIMITS.metaapi.maxBarsPerRequest));
  const startTime = body?.startTime != null ? Number(body.startTime) : undefined;
  if (!symbol)                     return json({ error: "symbol_required" }, 400);
  if (!ALLOWED_TF.includes(timeframe)) return json({ error: "timeframe_unsupported", allowed: ALLOWED_TF }, 400);

  // Resolve mapping (admin/service role used only to read user_mt_accounts).
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const mapping = await resolveActiveMtMapping(admin, userId);
  if (!mapping.row) return json({ error: "no_mt_account" }, 412);

  // Both ids resolved through the same row (ownership-verified by mapping).
  const metaapiAccountId = mapping.row?.metaapi_account_id ?? null;
  const tradingLayerAccountId = mapping.tradingLayerAccountId
    ?? mapping.tradingLayerTraderId
    ?? mapping.traderId
    ?? null;

  if (!metaapiAccountId && !tradingLayerAccountId) {
    return json({ error: "no_provider_route" }, 412);
  }

  try {
    const result = await getCandles(
      { symbol, timeframe, limit, startTime },
      { tradingLayerAccountId, metaapiAccountId },
    );
    // Admin-visible lightweight log line (stdout — surfaces in edge logs).
    console.log(JSON.stringify({
      ev: "get-chart-rates.served",
      userId, symbol, timeframe, limit, count: result.bars.length,
      source: result.source, served_ms: result.served_ms,
      fellBack: result.fellBackFromTradingLayer,
      fallbackReason: result.fallbackReason ?? null,
    }));
    return json({
      ok: true,
      symbol, timeframe,
      bars: result.bars,
      source: result.source,
      served_ms: result.served_ms,
      fellBackFromTradingLayer: result.fellBackFromTradingLayer,
      fallbackReason: result.fallbackReason ?? null,
      provider_limits: PROVIDER_LIMITS,
    });
  } catch (e) {
    const msg = (e as Error).message || "seam_error";
    console.log(JSON.stringify({ ev: "get-chart-rates.failed", userId, symbol, timeframe, error: msg }));
    return json({ ok: false, error: msg }, 502);
  }
});
