// MT4/MT5 sync edge function — mock implementation
// Generates realistic-looking account data, positions and equity snapshots.
// Swap the `generateMockSync` body with a real MetaApi.cloud call when ready.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "AUDUSD", "USDCAD", "NAS100", "BTCUSD"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockSync(seed: number) {
  const balance = +(8000 + (seed % 20000) + rand(-500, 1500)).toFixed(2);
  const openPnl = +rand(-450, 1200).toFixed(2);
  const equity = +(balance + openPnl).toFixed(2);
  const margin = +rand(200, 1800).toFixed(2);

  const positionCount = Math.floor(rand(1, 5));
  const positions = Array.from({ length: positionCount }).map((_, i) => {
    const side = Math.random() > 0.5 ? "buy" : "sell";
    const symbol = pick(SYMBOLS);
    const open = +rand(0.8, 2000).toFixed(symbol.includes("JPY") ? 2 : 5);
    const drift = open * rand(-0.004, 0.006);
    const current = +(open + (side === "buy" ? drift : -drift)).toFixed(
      symbol.includes("JPY") ? 2 : 5,
    );
    const volume = +rand(0.05, 1.5).toFixed(2);
    const profit = +((current - open) * (side === "buy" ? 1 : -1) * volume * 100).toFixed(2);
    return {
      ticket: `${Date.now()}${i}`,
      symbol,
      side,
      volume,
      open_price: open,
      current_price: current,
      stop_loss: +(open * (side === "buy" ? 0.995 : 1.005)).toFixed(5),
      take_profit: +(open * (side === "buy" ? 1.01 : 0.99)).toFixed(5),
      swap: +rand(-3, 0.5).toFixed(2),
      commission: +rand(-5, 0).toFixed(2),
      profit,
    };
  });

  return {
    balance,
    equity,
    margin,
    free_margin: +(equity - margin).toFixed(2),
    margin_level: margin > 0 ? +((equity / margin) * 100).toFixed(2) : 0,
    leverage: pick([100, 200, 500, 1000]),
    currency: "USD",
    positions,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const accountId: string | undefined = body.account_id;
    if (!accountId) {
      return new Response(JSON.stringify({ error: "account_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify ownership
    const { data: account, error: accErr } = await admin
      .from("user_mt_accounts")
      .select("id, user_id, login")
      .eq("id", accountId)
      .single();
    if (accErr || !account || account.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("user_mt_accounts")
      .update({ status: "syncing", status_message: "Fetching live data..." })
      .eq("id", accountId);

    // Generate mock data deterministically off the login digit count
    const seed = parseInt(account.login.replace(/\D/g, "") || "1", 10) || 1;
    const sync = generateMockSync(seed);

    // Update account
    await admin
      .from("user_mt_accounts")
      .update({
        balance: sync.balance,
        equity: sync.equity,
        margin: sync.margin,
        free_margin: sync.free_margin,
        margin_level: sync.margin_level,
        leverage: sync.leverage,
        currency: sync.currency,
        status: "connected",
        status_message: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    // Replace open positions
    await admin.from("mt_positions").delete().eq("account_id", accountId);
    if (sync.positions.length) {
      await admin.from("mt_positions").insert(
        sync.positions.map((p) => ({
          ...p,
          user_id: user.id,
          account_id: accountId,
        })),
      );
    }

    // Snapshot
    await admin.from("mt_account_snapshots").insert({
      user_id: user.id,
      account_id: accountId,
      balance: sync.balance,
      equity: sync.equity,
      margin: sync.margin,
    });

    return new Response(JSON.stringify({ ok: true, sync }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-mt-account error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
