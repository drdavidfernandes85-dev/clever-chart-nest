// get-trading-symbols — returns the connected MT5 broker's symbol list.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TL_BASE = "https://api.trading-layer.com/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Missing Authorization header." });
    }

    let limit = 100;
    try {
      if (req.method === "POST") {
        const body = await req.clone().json().catch(() => ({}));
        const n = Number(body?.limit);
        if (Number.isFinite(n) && n > 0 && n <= 500) limit = Math.floor(n);
      }
    } catch { /* ignore */ }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const TRADING_LAYER_API_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
    if (!TRADING_LAYER_API_KEY) {
      return json(500, { success: false, error: "Trading Layer API key not configured." });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { success: false, error: "Not authenticated." });
    }

    const { data: account, error: accErr } = await supabase
      .from("user_mt_accounts")
      .select("metaapi_account_id, status")
      .eq("user_id", userData.user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accErr) return json(500, { success: false, error: accErr.message });
    if (!account?.metaapi_account_id) {
      return json(200, { success: false, error: "No connected MT5 account found." });
    }

    const traderId = account.metaapi_account_id;
    const res = await fetch(
      `${TL_BASE}/accounts/${encodeURIComponent(traderId)}/symbols?limit=${limit}`,
      { headers: { Authorization: `Bearer ${TRADING_LAYER_API_KEY}`, "Content-Type": "application/json" } },
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json(200, {
        success: false,
        error: "Trading Layer is temporarily unavailable. Please refresh.",
        tradingLayerStatus: res.status,
      });
    }

    const raw: any[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.symbols)
        ? payload.symbols
        : Array.isArray(payload)
          ? payload
          : [];

    const symbols = raw
      .map((s: any) => {
        if (typeof s === "string") return { symbol: s, description: null };
        const symbol = s?.symbol ?? s?.name ?? s?.code ?? null;
        if (!symbol) return null;
        return {
          symbol: String(symbol),
          description: s?.description ?? s?.desc ?? null,
          digits: s?.digits ?? null,
          contractSize: s?.contractSize ?? s?.contract_size ?? null,
          assetClass: s?.assetClass ?? s?.asset_class ?? s?.category ?? null,
        };
      })
      .filter(Boolean);

    return json(200, { success: true, count: symbols.length, symbols });
  } catch (e) {
    return json(500, { success: false, error: e instanceof Error ? e.message : String(e) });
  }
});
