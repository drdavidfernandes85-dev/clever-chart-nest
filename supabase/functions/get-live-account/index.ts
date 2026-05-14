// get-live-account — returns live MT5 account snapshot for the logged-in user
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

    const { data: account, error: accErr } = await supabase
      .from("user_mt_accounts")
      .select("id, login, server_name, status, last_synced_at, metaapi_account_id, created_at")
      .eq("user_id", userId)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accErr) return json(500, { success: false, error: accErr.message });
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

    const [traderRes, posRes] = await Promise.all([
      fetch(`${TL_BASE}/traders/${encodeURIComponent(traderId)}`, { headers: tlHeaders }),
      fetch(`${TL_BASE}/accounts/${encodeURIComponent(traderId)}/positions`, { headers: tlHeaders }),
    ]);

    const traderData = await traderRes.json().catch(() => ({}));
    const positionsData = await posRes.json().catch(() => ({}));

    if (!traderRes.ok) {
      return json(200, {
        success: false,
        error: "Trading Layer is temporarily unavailable. Please retry in a moment.",
        tradingLayerStatus: traderRes.status,
        retryable: traderRes.status >= 500,
      });
    }

    const acc = traderData?.data?.account ?? {};
    const mt5 = traderData?.data?.mt5 ?? {};
    const positions = Array.isArray(positionsData?.data) ? positionsData.data : [];

    const floatingPnl = positions.reduce(
      (sum: number, p: any) => sum + (Number(p?.profit ?? p?.pnl ?? 0) || 0),
      0,
    );

    return json(200, {
      success: true,
      data: {
        balance: Number(acc.balance ?? mt5.balance ?? 0),
        equity: Number(acc.equity ?? mt5.equity ?? 0),
        margin: Number(acc.margin ?? mt5.margin ?? 0),
        free_margin: Number(acc.free_margin ?? acc.freeMargin ?? mt5.free_margin ?? mt5.freeMargin ?? 0),
        currency: acc.currency ?? mt5.currency ?? "USD",
        leverage: acc.leverage ?? mt5.leverage ?? null,
        floating_pnl: floatingPnl,
        open_positions: positions.length,
        positions: positions.map((p: any) => ({
          ticket: p?.ticket ?? p?.id ?? null,
          symbol: p?.symbol ?? "",
          side: (p?.side ?? p?.action ?? p?.type ?? "").toString().toLowerCase().includes("sell") ? "sell" : "buy",
          volume: Number(p?.volume ?? p?.lots ?? 0),
          entry_price: Number(p?.open_price ?? p?.openPrice ?? p?.entry_price ?? p?.price ?? 0),
          current_price: Number(p?.current_price ?? p?.currentPrice ?? p?.price ?? 0),
          stop_loss: p?.stop_loss ?? p?.sl ?? null,
          take_profit: p?.take_profit ?? p?.tp ?? null,
          profit: Number(p?.profit ?? p?.pnl ?? 0),
        })),
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
