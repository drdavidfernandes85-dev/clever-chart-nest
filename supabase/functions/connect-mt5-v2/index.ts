// connect-mt5-v2
// MT5 credential validation via Trading Layer.
// Flow: create/update trader -> POST mt5-credentials/test (validateOnly) -> if "connect" mode, persist credentials.
// Never returns success unless Trading Layer confirms validated AND connected.

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

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
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

  // 1. Authenticate Supabase user (required)
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  let userId: string | null = null;
  let userEmail: string | null = null;
  if (authHeader) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    userEmail = data.user?.email ?? null;
  }
  if (!userId) {
    return json(401, {
      success: false,
      error: "You must be signed in to validate an MT5 account.",
    });
  }

  const tlHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    // 2. Create/update trader
    const traderRes = await fetchWithTimeout(
      `${TRADING_LAYER_BASE}/api/v1/traders`,
      {
        method: "POST",
        headers: tlHeaders,
        body: JSON.stringify({
          externalTraderId: userId,
          displayName: userEmail || userId,
          metadata: { source: "trading_room_website" },
        }),
      },
      15000,
    );
    const traderJson = await readJson(traderRes);

    if (!traderRes.ok) {
      return json(502, {
        success: false,
        error: "Failed to create/update trader in Trading Layer.",
        step: "traders",
        tradingLayerStatus: traderRes.status,
        tradingLayerResponse: traderJson,
      });
    }

    // 3. Extract accountId
    const accountId = traderJson?.data?.traderId;
    if (!accountId) {
      return json(502, {
        success: false,
        error: "Trading Layer did not return a traderId.",
        step: "traders",
        tradingLayerStatus: traderRes.status,
        tradingLayerResponse: traderJson,
      });
    }

    // 4. Test credentials
    const testRes = await fetchWithTimeout(
      `${TRADING_LAYER_BASE}/api/v1/accounts/${accountId}/mt5-credentials/test`,
      {
        method: "POST",
        headers: tlHeaders,
        body: JSON.stringify({
          login: Number(account_number),
          password,
          server,
          validateOnly: true,
        }),
      },
      20000,
    );
    const testJson = await readJson(testRes);

    // 5. 422 or any non-ok = invalid credentials
    if (!testRes.ok || testRes.status === 422) {
      return json(422, {
        success: false,
        error: "Invalid MT5 credentials. Please check login, password and server.",
        step: "mt5-credentials/test",
        tradingLayerStatus: testRes.status,
        tradingLayerResponse: testJson,
      });
    }

    // 6 & 7. Strict success check
    const data = testJson?.data;
    const validated = data?.validated === true;
    const connected = data?.connected === true;
    const account = data?.account;

    if (!validated || !connected || !account) {
      return json(422, {
        success: false,
        error: "Invalid MT5 credentials. Please check login, password and server.",
        step: "mt5-credentials/test",
        tradingLayerStatus: testRes.status,
        tradingLayerResponse: testJson,
      });
    }

    // 8. In connect mode, persist credentials in Trading Layer
    let persistResponse: any = null;
    if (mode === "connect") {
      const persistRes = await fetchWithTimeout(
        `${TRADING_LAYER_BASE}/api/v1/accounts/${accountId}/mt5-credentials`,
        {
          method: "POST",
          headers: tlHeaders,
          body: JSON.stringify({
            login: Number(account_number),
            password,
            server,
          }),
        },
        20000,
      );
      persistResponse = await readJson(persistRes);
      if (!persistRes.ok) {
        return json(502, {
          success: false,
          error: "Credentials validated but failed to save in Trading Layer.",
          step: "mt5-credentials",
          tradingLayerStatus: persistRes.status,
          tradingLayerResponse: persistResponse,
        });
      }

      // 9. Persist record locally — never store the password.
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
              nickname: account?.name ?? `Infinox ${account_number}`,
              status: "connected",
              balance: Number(account?.balance ?? 0),
              equity: Number(account?.equity ?? 0),
              leverage: Number(account?.leverage ?? 0),
              currency: account?.currency ?? "USD",
              metaapi_account_id: String(accountId),
              investor_password_encrypted: null,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "user_id,login,server_name" },
          );
      } catch (e) {
        console.warn("user_mt_accounts upsert failed:", e);
      }
    }

    return json(200, {
      success: true,
      mode,
      accountId,
      account,
      tradingLayerStatus: testRes.status,
      tradingLayerResponse: testJson,
      persistResponse,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("connect-mt5-v2 error:", msg);
    return json(500, { success: false, error: `Trading Layer connectivity error: ${msg}` });
  }
});
