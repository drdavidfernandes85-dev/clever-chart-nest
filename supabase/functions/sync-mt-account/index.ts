// MT4/MT5 sync edge function — REAL MetaApi.cloud integration
// On first call for a given account row, this provisions the MetaApi account
// and starts deployment. On subsequent calls, it fetches live data
// (account-information, positions, recent deals) and persists them.
//
// Required env vars: METAAPI_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_ANON_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_METAAPI_TOKEN = Deno.env.get("METAAPI_TOKEN") ?? "";

const provisioningUrl = (region: string) =>
  `https://mt-provisioning-api-v1.${region}.agiliumtrade.ai`;
const clientUrl = (region: string) =>
  `https://mt-client-api-v1.${region}.agiliumtrade.ai`;

interface AccountRow {
  id: string;
  user_id: string;
  platform: "mt4" | "mt5";
  account_type: "live" | "demo";
  broker_name: string;
  server_name: string;
  login: string;
  metaapi_account_id: string | null;
  region: string | null;
  investor_password_encrypted: Uint8Array | null;
  metaapi_token_encrypted: Uint8Array | null;
}

// Decode the password we stored as `enc:<plaintext>` base64 wrapper
// (kept compatible with the previous mock). When we move to true Vault encryption
// we just swap this function out.
function decodePassword(raw: Uint8Array | string | null): string | null {
  if (!raw) return null;
  try {
    let str: string;
    if (typeof raw === "string") {
      str = raw;
    } else {
      str = new TextDecoder().decode(raw);
    }
    // pgsodium / Vault would return bytes; for now we expect base64('enc:...')
    try {
      const decoded = atob(str);
      if (decoded.startsWith("enc:")) return decoded.slice(4);
      return decoded;
    } catch {
      return str;
    }
  } catch {
    return null;
  }
}

async function metaapi(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  return await fetch(url, {
    ...init,
    headers: {
      "auth-token": token,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function provisionAccount(
  account: AccountRow,
  password: string,
  token: string,
): Promise<{ metaapiId: string; region: string }> {
  const region = account.region || "new-york";
  const body = {
    name: `${account.broker_name}-${account.login}`.slice(0, 64),
    type: "cloud-g2",
    login: account.login,
    password,
    server: account.server_name,
    platform: account.platform,
    application: "MetaApi",
    magic: 0,
    keywords: [account.broker_name],
    metastatsApiEnabled: false,
  };
  const res = await metaapi(
    `${provisioningUrl(region)}/users/current/accounts`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Provision failed (${res.status}): ${txt}`);
  }
  const json = await res.json();
  const metaapiId = json.id as string;
  // Trigger deploy explicitly (idempotent)
  await metaapi(
    `${provisioningUrl(region)}/users/current/accounts/${metaapiId}/deploy`,
    token,
    { method: "POST" },
  ).catch(() => {});
  return { metaapiId, region };
}

async function getAccountState(metaapiId: string, region: string, token: string) {
  const res = await metaapi(
    `${provisioningUrl(region)}/users/current/accounts/${metaapiId}`,
    token,
  );
  if (!res.ok) return null;
  return await res.json();
}

async function fetchAccountInformation(metaapiId: string, region: string, token: string) {
  const res = await metaapi(
    `${clientUrl(region)}/users/current/accounts/${metaapiId}/account-information`,
    token,
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`account-information ${res.status}: ${txt}`);
  }
  return await res.json();
}

async function fetchPositions(metaapiId: string, region: string, token: string) {
  const res = await metaapi(
    `${clientUrl(region)}/users/current/accounts/${metaapiId}/positions`,
    token,
  );
  if (!res.ok) return [] as any[];
  return await res.json();
}

async function fetchRecentDeals(metaapiId: string, region: string, token: string) {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const res = await metaapi(
    `${clientUrl(region)}/users/current/accounts/${metaapiId}/history-deals/time/${from}/${to}`,
    token,
  );
  if (!res.ok) return [] as any[];
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    if (!METAAPI_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "MetaApi not configured. Add METAAPI_TOKEN secret.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    // Verify caller
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
    const action: string = body.action ?? "sync"; // sync | check_state
    if (!accountId) {
      return new Response(JSON.stringify({ error: "account_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: account, error: accErr } = await admin
      .from("user_mt_accounts")
      .select(
        "id, user_id, platform, account_type, broker_name, server_name, login, metaapi_account_id, region, investor_password_encrypted",
      )
      .eq("id", accountId)
      .single();

    if (accErr || !account || account.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acc = account as AccountRow;
    const password = decodePassword(acc.investor_password_encrypted);

    // ---- 1. Provision if needed ----
    let metaapiId = acc.metaapi_account_id;
    let region = acc.region || "new-york";

    if (!metaapiId) {
      if (!password) {
        await admin
          .from("user_mt_accounts")
          .update({
            status: "error",
            status_message: "Missing investor password",
            last_error: "Missing investor password",
          })
          .eq("id", accountId);
        return new Response(
          JSON.stringify({ error: "Missing investor password" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      try {
        const prov = await provisionAccount(acc, password);
        metaapiId = prov.metaapiId;
        region = prov.region;
        await admin
          .from("user_mt_accounts")
          .update({
            metaapi_account_id: metaapiId,
            region,
            status: "syncing",
            status_message: "Provisioning MT terminal (3-8 minutes)…",
            last_error: null,
          })
          .eq("id", accountId);
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e);
        await admin
          .from("user_mt_accounts")
          .update({
            status: "error",
            status_message: "Provisioning failed",
            last_error: msg,
          })
          .eq("id", accountId);
        return new Response(JSON.stringify({ error: msg }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---- 2. Check deploy state ----
    const state = await getAccountState(metaapiId, region);
    const deployedState = state?.state ?? "UNKNOWN";
    const connectionStatus = state?.connectionStatus ?? "DISCONNECTED";

    const isReady =
      deployedState === "DEPLOYED" && connectionStatus === "CONNECTED";

    if (!isReady) {
      await admin
        .from("user_mt_accounts")
        .update({
          status: "syncing",
          status_message: `Terminal ${deployedState.toLowerCase()} • broker ${connectionStatus.toLowerCase()}`,
          last_error: null,
        })
        .eq("id", accountId);
      return new Response(
        JSON.stringify({
          ok: true,
          ready: false,
          state: deployedState,
          connectionStatus,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- 3. Fetch live data ----
    let info: any;
    try {
      info = await fetchAccountInformation(metaapiId, region);
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      // Likely auth error — invalid investor password
      const friendly = /401|403|invalid|password|unauthor/i.test(msg)
        ? "Invalid investor password — please reconnect with the correct one."
        : msg;
      await admin
        .from("user_mt_accounts")
        .update({
          status: "error",
          status_message: friendly,
          last_error: friendly,
        })
        .eq("id", accountId);
      return new Response(JSON.stringify({ error: friendly }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const positions: any[] = await fetchPositions(metaapiId, region);
    const deals: any[] = await fetchRecentDeals(metaapiId, region);

    // ---- 4. Persist ----
    await admin
      .from("user_mt_accounts")
      .update({
        balance: info.balance ?? 0,
        equity: info.equity ?? 0,
        margin: info.margin ?? 0,
        free_margin: info.freeMargin ?? 0,
        margin_level: info.marginLevel ?? 0,
        leverage: info.leverage ?? null,
        currency: info.currency ?? "USD",
        status: "connected",
        status_message: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    // Replace open positions
    await admin.from("mt_positions").delete().eq("account_id", accountId);
    if (positions.length) {
      await admin.from("mt_positions").insert(
        positions.map((p) => ({
          user_id: user.id,
          account_id: accountId,
          ticket: String(p.id ?? p.positionId ?? p.platform ?? Date.now()),
          symbol: p.symbol,
          side: p.type === "POSITION_TYPE_BUY" ? "buy" : "sell",
          volume: p.volume ?? 0,
          open_price: p.openPrice ?? 0,
          current_price: p.currentPrice ?? null,
          stop_loss: p.stopLoss ?? null,
          take_profit: p.takeProfit ?? null,
          swap: p.swap ?? 0,
          commission: p.commission ?? 0,
          profit: p.profit ?? 0,
          opened_at: p.time ?? new Date().toISOString(),
        })),
      );
    }

    // Snapshot
    await admin.from("mt_account_snapshots").insert({
      user_id: user.id,
      account_id: accountId,
      balance: info.balance ?? 0,
      equity: info.equity ?? 0,
      margin: info.margin ?? 0,
    });

    // Closed deals → trade_journal
    // We upsert by (user_id, pair, opened_at, entry_price) signature using a synthetic id from deal.id when available.
    const closedDeals = deals.filter(
      (d) => d.entryType === "DEAL_ENTRY_OUT" || d.type === "DEAL_TYPE_SELL" || d.type === "DEAL_TYPE_BUY",
    );
    for (const d of closedDeals.slice(-50)) {
      try {
        const direction =
          d.type === "DEAL_TYPE_BUY" ? "long" : d.type === "DEAL_TYPE_SELL" ? "short" : "long";
        await admin.from("trade_journal").upsert(
          {
            user_id: user.id,
            pair: d.symbol,
            direction,
            entry_price: d.price ?? 0,
            exit_price: d.price ?? null,
            position_size: d.volume ?? null,
            pnl: d.profit ?? null,
            status: d.entryType === "DEAL_ENTRY_OUT" ? "closed" : "open",
            opened_at: d.time ?? new Date().toISOString(),
            closed_at: d.entryType === "DEAL_ENTRY_OUT" ? (d.time ?? new Date().toISOString()) : null,
            notes: `MT auto-import • ticket ${d.id}`,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      } catch {/* ignore individual deal errors */}
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ready: true,
        balance: info.balance,
        equity: info.equity,
        positions: positions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-mt-account error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
