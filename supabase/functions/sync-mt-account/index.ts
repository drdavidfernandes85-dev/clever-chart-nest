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
  investor_password_encrypted: Uint8Array | string | { type: string; data: number[] } | null;
  metaapi_token_encrypted: Uint8Array | string | { type: string; data: number[] } | null;
}

// Convert any of the shapes Postgres bytea may arrive as into a string.
function bytesToString(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  // PostgREST sometimes returns bytea as { type: "Buffer", data: number[] }
  if (typeof raw === "object" && raw !== null && Array.isArray((raw as any).data)) {
    return new TextDecoder().decode(new Uint8Array((raw as any).data));
  }
  return null;
}

// Decode the password/token we stored as base64('enc:<plaintext>').
// Falls back gracefully if the value is already plaintext.
function decodePassword(raw: unknown): string | null {
  const str = bytesToString(raw);
  if (!str) return null;
  const trimmed = str.trim();
  try {
    const decoded = atob(trimmed);
    if (decoded.startsWith("enc:")) return decoded.slice(4).trim();
    return decoded.trim();
  } catch {
    return trimmed;
  }
}

const METAAPI_PROVISIONING_HOST = "mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const provisioningUrl = (_region: string) =>
  `https://${METAAPI_PROVISIONING_HOST}`;
const clientUrl = (region: string) =>
  `https://mt-client-api-v1.${region}.agiliumtrade.agiliumtrade.ai`;

const METAAPI_TIMEOUT_MS = 30_000;
const METAAPI_RETRIES = 3;
const METAAPI_RETRY_DELAY_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getMetaApiHost(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === METAAPI_PROVISIONING_HOST) return hostname;
    if (/^mt-client-api-v1\.[a-z0-9-]+\.agiliumtrade\.agiliumtrade\.ai$/i.test(hostname)) {
      return hostname;
    }
    if (/^mt-(provisioning|client)-api-v1\.[a-z0-9-]+\.agiliumtrade\.ai$/i.test(hostname)) {
      return hostname;
    }
    return null;
  } catch {
    return null;
  }
}

function createMetaApiClient(url: string): Deno.HttpClient | undefined {
  const host = getMetaApiHost(url);
  if (!host) return undefined;

  // Temporary workaround for MetaApi TLS chain issues.
  // Scope certificate bypass to MetaApi hosts only.
  return Deno.createHttpClient({
    unsafelyIgnoreCertificateErrors: [host],
    http2: false,
  });
}

interface MetaApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

async function metaapi(
  url: string,
  token: string,
  init: MetaApiRequestOptions = {},
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= METAAPI_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("MetaApi timeout"), init.timeoutMs ?? METAAPI_TIMEOUT_MS);
    const client = createMetaApiClient(url);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        client,
        headers: {
          "auth-token": token,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "infinox-elite-trading/1.0",
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        console.error("MetaApi HTTP error", {
          url,
          method: init.method ?? "GET",
          status: response.status,
          statusText: response.statusText,
          attempt,
        });
      }

      return response;
    } catch (e) {
      lastErr = e;
      const message = String(e instanceof Error ? e.message : e);
      console.error("MetaApi request failed", {
        url,
        method: init.method ?? "GET",
        attempt,
        error: message,
      });

      const retryable = /broken pipe|connection|reset|stream closed|SendRequest|EOF|timed? out|aborted/i.test(message);
      if (!retryable || attempt === METAAPI_RETRIES) {
        throw e;
      }

      await sleep(METAAPI_RETRY_DELAY_MS);
    } finally {
      clearTimeout(timeoutId);
      client?.close();
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}


// Map raw MetaApi provisioning errors to a clear, user-facing message.
// Especially important for E_AUTH which is a common Infinox edge case
// (server name capitalization, "Live" vs "Demo", investor vs master pwd).
function friendlyProvisionError(status: number, raw: string, account: AccountRow): string {
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch { /* keep raw */ }

  const details = parsed?.details ?? "";
  const message = parsed?.message ?? raw;

  if (details === "E_AUTH" || /failed to authenticate/i.test(message)) {
    return [
      `MetaApi could not log in to MT5 #${account.login} on "${account.server_name}".`,
      `This usually means one of:`,
      `• Wrong server name — for Infinox Live use "InfinoxLimited-MT5Live" exactly.`,
      `• You entered the master password instead of the investor (read-only) password.`,
      `• The account is disabled or password was changed in the broker portal.`,
      `Please double-check on MT5 desktop, then reconnect.`,
    ].join(" ");
  }

  if (status === 429) {
    return "MetaApi is rate-limiting this account due to repeated auth errors. Wait a few minutes before retrying.";
  }

  return `Provision failed (${status}): ${message}`;
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

  console.log("MetaApi provision request", {
    login: account.login,
    server: account.server_name,
    platform: account.platform,
    region,
    passwordLength: password.length,
  });

  const res = await metaapi(
    `${provisioningUrl(region)}/users/current/accounts`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );

  if (!res.ok) {
    const txt = await res.text();
    console.error("MetaApi provision response", {
      status: res.status,
      statusText: res.statusText,
      body: txt.slice(0, 1000),
    });
    throw new Error(friendlyProvisionError(res.status, txt, account));
  }

  const json = await res.json();
  const metaapiId = json.id as string;
  console.log("MetaApi account created", { metaapiId, region });

  // Give MetaApi 7s to settle the new account record before deploying.
  // This avoids transient E_AUTH on the very first deploy attempt.
  await sleep(7_000);

  // Trigger deploy explicitly (idempotent). Log the result so we can
  // diagnose broker auth issues that surface only at deploy time.
  try {
    const deployRes = await metaapi(
      `${provisioningUrl(region)}/users/current/accounts/${metaapiId}/deploy`,
      token,
      { method: "POST" },
    );
    if (!deployRes.ok) {
      const deployTxt = await deployRes.text();
      console.error("MetaApi deploy response", {
        status: deployRes.status,
        body: deployTxt.slice(0, 500),
      });
    } else {
      console.log("MetaApi deploy triggered", { metaapiId });
    }
  } catch (e) {
    console.error("MetaApi deploy error (non-fatal)", String(e));
  }

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
    // Token is resolved per-account below; if neither per-account nor global is set we fail there.

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
        "id, user_id, platform, account_type, broker_name, server_name, login, metaapi_account_id, region, investor_password_encrypted, metaapi_token_encrypted",
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
    // Resolve which MetaApi token to use: per-account first, fall back to shared.
    const userToken = decodePassword(acc.metaapi_token_encrypted);
    let token = (userToken && userToken.trim()) || FALLBACK_METAAPI_TOKEN;
    // Sanity: a real MetaApi token is a JWT (~500–1500 chars). If the stored
    // value is huge, the user pasted something wrong (e.g. JSON dump) — fall
    // back to the shared platform token rather than send a 34KB header.
    if (token && token.length > 4000) {
      console.error("MetaApi token rejected: oversized", { length: token.length });
      token = FALLBACK_METAAPI_TOKEN;
    }
    if (!token) {
      const msg = userToken && userToken.length > 4000
        ? "Saved MetaApi token is invalid (too large). Re-paste just the JWT token from app.metaapi.cloud/token."
        : "No MetaApi token configured for this account. Add yours in Connect → MetaApi token.";
      await admin
        .from("user_mt_accounts")
        .update({ status: "error", status_message: "Invalid MetaApi token", last_error: msg })
        .eq("id", accountId);
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        const prov = await provisionAccount(acc, password, token);
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
    const state = await getAccountState(metaapiId, region, token);
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
      info = await fetchAccountInformation(metaapiId, region, token);
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

    const positions: any[] = await fetchPositions(metaapiId, region, token);
    const deals: any[] = await fetchRecentDeals(metaapiId, region, token);

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
