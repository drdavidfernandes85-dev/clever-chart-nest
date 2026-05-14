// Trading Dashboard edge function
// Returns live trading data for the logged-in user's connected MT5 account
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
    const userId = userData.user.id;

    // Fetch the most recent connected MT account
    const { data: account, error: accErr } = await supabase
      .from("user_mt_accounts")
      .select("id, login, server_name, status, last_synced_at, metaapi_account_id, created_at")
      .eq("user_id", userId)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accErr) {
      return json(500, { success: false, error: accErr.message });
    }
    if (!account) {
      return json(200, { success: false, error: "No connected trading account found." });
    }

    const traderId = account.metaapi_account_id;
    if (!traderId) {
      return json(200, { success: false, error: "Connected account is missing a Trading Layer trader id." });
    }

    const tlHeaders = {
      "Authorization": `Bearer ${TRADING_LAYER_API_KEY}`,
      "Content-Type": "application/json",
    };

    const [traderRes, symbolsRes] = await Promise.all([
      fetch(`${TL_BASE}/traders/${encodeURIComponent(traderId)}`, { headers: tlHeaders }),
      fetch(`${TL_BASE}/accounts/${encodeURIComponent(traderId)}/symbols?limit=100`, { headers: tlHeaders }),
    ]);

    const traderData = await traderRes.json().catch(() => ({}));
    const symbolsData = await symbolsRes.json().catch(() => ({}));

    if (!traderRes.ok) {
      return json(200, {
        success: false,
        error: "Trading Layer is temporarily unavailable. Please retry in a moment.",
        tradingLayerStatus: traderRes.status,
        tradingLayerResponse: traderData,
        retryable: traderRes.status >= 500,
      });
    }

    return json(200, {
      success: true,
      account: traderData?.data?.account ?? null,
      mt5: traderData?.data?.mt5 ?? null,
      symbols: symbolsData?.data ?? [],
      linkedAccount: {
        account_number: account.login,
        server: account.server_name,
        status: account.status,
        last_synced: account.last_synced_at,
      },
    });
  } catch (e) {
    return json(500, { success: false, error: e instanceof Error ? e.message : String(e) });
  }
});
