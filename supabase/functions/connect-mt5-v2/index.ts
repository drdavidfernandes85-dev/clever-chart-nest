// connect-mt5-v2
// MT5 credential validation via Trading Layer only. No mocked balance/equity.
// Returns success:true ONLY when Trading Layer confirms the account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRADING_LAYER_BASE = "https://api.trading-layer.com";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Body {
  account_number?: string;
  server?: string;
  password?: string;
  mode?: "test" | "connect";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { success: false, error: "Invalid JSON body." });
  }

  const account_number = String(body.account_number ?? "").trim();
  const server = String(body.server ?? "").trim();
  const password = String(body.password ?? "");
  const mode = body.mode === "connect" ? "connect" : "test";

  if (!account_number || !server || !password) {
    return json(400, {
      success: false,
      error: "Missing required fields: account_number, server, password.",
    });
  }
  if (!/^\d{4,12}$/.test(account_number)) {
    return json(422, { success: false, error: "Invalid MT5 login number." });
  }
  if (password.length < 4) {
    return json(422, { success: false, error: "Password is too short." });
  }

  const apiKey = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!apiKey) {
    return json(500, {
      success: false,
      error: "Trading Layer is not configured (TRADING_LAYER_API_KEY missing).",
    });
  }

  // Auth (required for connect mode)
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  let userId: string | null = null;
  if (authHeader) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (mode === "connect" && !userId) {
    return json(401, {
      success: false,
      error: "You must be signed in to connect an account.",
    });
  }

  // Validate credentials with Trading Layer
  try {
    const res = await fetchWithTimeout(
      `${TRADING_LAYER_BASE}/accounts/validate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          platform: "mt5",
          broker: "Infinox",
          server,
          login: account_number,
          password,
        }),
      },
      15000,
    );

    const text = await res.text();
    let payload: any = null;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    if (!res.ok) {
      return json(res.status === 401 || res.status === 422 ? res.status : 422, {
        success: false,
        error: payload?.error || payload?.message || `Trading Layer rejected credentials (${res.status})`,
        upstream_status: res.status,
        upstream: payload,
      });
    }

    const acc = payload?.account ?? payload;
    const account = {
      login: account_number,
      server,
      balance: Number(acc?.balance ?? 0),
      equity: Number(acc?.equity ?? 0),
      leverage: Number(acc?.leverage ?? 0),
      currency: acc?.currency ?? "USD",
      name: acc?.name ?? `Infinox ${account_number}`,
    };

    if (mode === "test") {
      return json(200, { success: true, mode, account, upstream: payload });
    }

    if (userId) {
      try {
        await supabase
          .from("user_mt_accounts")
          .upsert(
            {
              user_id: userId,
              platform: "mt5",
              broker_name: "Infinox",
              server_name: server,
              login: account_number,
              nickname: account.name,
              status: "connected",
              balance: account.balance,
              equity: account.equity,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "user_id,login,server_name" },
          );
      } catch (e) {
        console.warn("user_mt_accounts upsert failed:", e);
      }
    }

    return json(200, { success: true, mode, account, upstream: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("connect-mt5-v2 error:", msg);
    return json(500, { success: false, error: `Trading Layer connectivity error: ${msg}` });
  }
});
