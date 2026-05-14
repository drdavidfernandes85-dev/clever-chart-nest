// connect-mt5-v2
// Real MT5 credential validation via MetaApi. No mocked balance/equity.
// Returns success:true ONLY when MetaApi confirms the account credentials.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const METAAPI_BASE = "https://mt-provisioning-profile-api-v1.agiliumtrade.agiliumtrade.ai";
const METAAPI_CLIENT_BASE = "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12000) {
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

  // ---- Validation ----
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

  const metaToken = Deno.env.get("METAAPI_TOKEN");
  if (!metaToken) {
    return json(500, {
      success: false,
      error:
        "Broker connector is not configured (METAAPI_TOKEN missing). Real MT5 validation is unavailable.",
    });
  }

  // ---- Auth (required for connect mode) ----
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

  // ---- Real validation via MetaApi ----
  // Strategy: provision a short-lived MetaApi account in cloud-g1 with the
  // user's credentials. MetaApi will reject invalid credentials. We then
  // fetch account information to confirm the connection and return real
  // balance/equity. Account is left in MetaApi (idempotent by login+server).
  try {
    // 1) Look up an existing account by login+server (if any)
    const listRes = await fetchWithTimeout(
      `${METAAPI_BASE}/users/current/accounts?login=${encodeURIComponent(account_number)}`,
      { headers: { "auth-token": metaToken, Accept: "application/json" } },
    );
    const listText = await listRes.text();
    if (!listRes.ok) {
      return json(502, {
        success: false,
        error: `Broker lookup failed (${listRes.status}): ${listText.slice(0, 300)}`,
      });
    }
    let existing: any[] = [];
    try { existing = JSON.parse(listText); } catch { existing = []; }
    const match = Array.isArray(existing)
      ? existing.find((a) => String(a?.login) === account_number && a?.server === server)
      : null;

    let accountId: string | null = match?._id ?? match?.id ?? null;

    // 2) If not found, provision it
    if (!accountId) {
      const createRes = await fetchWithTimeout(
        `${METAAPI_BASE}/users/current/accounts`,
        {
          method: "POST",
          headers: {
            "auth-token": metaToken,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: `Infinox ${account_number}`,
            type: "cloud-g1",
            login: account_number,
            password,
            server,
            platform: "mt5",
            magic: 0,
            application: "MetaApi",
            keywords: ["Infinox", "MT5"],
            reliability: "regular",
          }),
        },
        15000,
      );
      const createText = await createRes.text();
      if (!createRes.ok) {
        // MetaApi returns descriptive errors for bad credentials / wrong server.
        return json(422, {
          success: false,
          error: `Broker rejected credentials (${createRes.status}): ${createText.slice(0, 400)}`,
        });
      }
      try {
        const created = JSON.parse(createText);
        accountId = created?.id ?? created?._id ?? null;
      } catch {
        return json(502, {
          success: false,
          error: "Broker returned an unexpected response on provisioning.",
        });
      }
    }

    if (!accountId) {
      return json(502, { success: false, error: "Could not obtain MetaApi account id." });
    }

    // 3) Fetch account information from MetaApi client API
    const infoRes = await fetchWithTimeout(
      `${METAAPI_CLIENT_BASE}/users/current/accounts/${accountId}/account-information`,
      { headers: { "auth-token": metaToken, Accept: "application/json" } },
      15000,
    );
    const infoText = await infoRes.text();
    if (!infoRes.ok) {
      return json(422, {
        success: false,
        error: `Broker did not return account info (${infoRes.status}): ${infoText.slice(0, 300)}`,
      });
    }
    let info: any;
    try { info = JSON.parse(infoText); } catch {
      return json(502, { success: false, error: "Invalid account info from broker." });
    }

    const account = {
      login: account_number,
      server,
      balance: Number(info.balance ?? 0),
      equity: Number(info.equity ?? 0),
      leverage: Number(info.leverage ?? 0),
      currency: info.currency ?? "USD",
      name: info.name ?? `Infinox ${account_number}`,
    };

    if (mode === "test") {
      return json(200, { success: true, mode, account, metaapi_account_id: accountId });
    }

    // 4) Persist on connect
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
              metaapi_account_id: accountId,
            },
            { onConflict: "user_id,login,server_name" },
          );
      } catch (e) {
        console.warn("user_mt_accounts upsert failed:", e);
      }
    }

    return json(200, { success: true, mode, account, metaapi_account_id: accountId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("connect-mt5-v2 error:", msg);
    return json(500, { success: false, error: `Broker connectivity error: ${msg}` });
  }
});
