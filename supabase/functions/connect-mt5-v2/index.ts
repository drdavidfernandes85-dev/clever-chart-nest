// connect-mt5-v2
// MT5 credential validation via Trading Layer.
// Flow: GET /tenant -> use ownerAccount.accountId -> POST /mt5-credentials/test (validateOnly).
// Strict success: requires validated && connected && account && login matches.

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
  mode?: "test" | "connect" | "disconnect";
}

/**
 * Resolve the Trading Layer API key from edge-function secrets.
 * Prefer TRADING_LAYER_PUBLIC_API_KEY, fall back to TRADING_LAYER_API_KEY.
 * Server-side only — never returned, logged, or exposed to the browser.
 */
function resolveTradingLayerKey(): string | null {
  const k =
    Deno.env.get("TRADING_LAYER_PUBLIC_API_KEY") ||
    Deno.env.get("TRADING_LAYER_API_KEY") ||
    "";
  return k ? k : null;
}

function tlAuthHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  } as const;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000) {
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

function retryAfterSeconds(payload: any): number | null {
  const value = Number(payload?.retry_after ?? payload?.retryAfter);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isRetryableTradingLayerFailure(status: number, payload: any): boolean {
  return payload?.retryable === true || status === 502 || status === 503 || status === 504;
}

// Module-level tenant cache to avoid hitting Trading Layer's 120/min rate limit
// on /tenant. Tenant data is effectively static for the API key.
const TENANT_TTL_MS = 5 * 60 * 1000;
let tenantCache: { at: number; data: any } | null = null;

async function fetchTenantCached(apiKey: string, tlHeaders: Record<string, string>) {
  const now = Date.now();
  if (tenantCache && now - tenantCache.at < TENANT_TTL_MS) {
    return { status: 200, ok: true, json: tenantCache.data, cached: true };
  }
  // Try up to 2 times with backoff on 429.
  let lastStatus = 0;
  let lastJson: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetchWithTimeout(
      `${TRADING_LAYER_BASE}/api/v1/tenant`,
      { method: "GET", headers: tlHeaders },
      15000,
    );
    const body = await readJson(res);
    lastStatus = res.status;
    lastJson = body;
    if (res.ok) {
      tenantCache = { at: Date.now(), data: body };
      return { status: res.status, ok: true, json: body, cached: false };
    }
    if (res.status === 429) {
      // If we have any stale cache, serve it rather than failing the user.
      if (tenantCache) {
        return { status: 200, ok: true, json: tenantCache.data, cached: true };
      }
      const retry = retryAfterSeconds(body) ?? 1;
      await new Promise((r) => setTimeout(r, Math.min(retry, 2) * 1000));
      continue;
    }
    break;
  }
  return { status: lastStatus, ok: false, json: lastJson, cached: false };
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
  const mode: "test" | "connect" | "disconnect" =
    body.mode === "connect" ? "connect" : body.mode === "disconnect" ? "disconnect" : "test";

  // Sanitized config check — never leak secret-name details to the client.
  const apiKey = resolveTradingLayerKey();
  if (!apiKey) {
    return json(500, {
      success: false,
      error: "TL_CONFIG_MISSING",
      message: "Trading Layer is not configured.",
    });
  }

  if (mode !== "disconnect") {
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
  }


  // Authenticate Supabase user
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
  if (!userId) {
    return json(401, {
      success: false,
      error: "You must be signed in to validate an MT5 account.",
    });
  }

  const tlHeaders = tlAuthHeaders(apiKey);

  try {
    // 1. Get tenant (cached, with 429 backoff)
    const tenantResult = await fetchTenantCached(apiKey, tlHeaders);
    const tenantJson = tenantResult.json;

    if (tenantResult.status === 401 || tenantResult.status === 403) {
      return json(502, {
        success: false,
        step: "tenant",
        error: "TL_AUTH_FAILED",
        message: "Trading Layer rejected the configured credentials.",
        tradingLayerStatus: tenantResult.status,
      });
    }
    if (!tenantResult.ok) {
      const isRate = tenantResult.status === 429;
      return json(isRate ? 429 : 502, {
        success: false,
        step: "tenant",
        error: isRate ? "TL_RATE_LIMITED" : "Failed to load Trading Layer tenant.",
        message: isRate
          ? "Trading Layer is rate limiting requests. Please retry in a few seconds."
          : undefined,
        tradingLayerStatus: tenantResult.status,
        tradingLayerResponse: tenantJson,
      });
    }

    // 2. Resolve the Trading Layer traderId for this MT5 login.
    //    Trading Layer's /accounts/{accountId} path parameter is the traderId.
    //    The tenant ownerAccount.accountId is NOT a valid path accountId.
    const ownerAccountId = tenantJson?.data?.ownerAccount?.accountId ?? null;

    // Try to use a previously-saved traderId for this user+login first.
    let traderId: string | null = null;
    let externalTraderId: string | null = null;
    if (account_number) {
      const { data: existingRow } = await supabase
        .from("user_mt_accounts")
        .select("trading_layer_trader_id, trading_layer_external_trader_id")
        .eq("user_id", userId)
        .eq("platform", "mt5")
        .eq("login", account_number)
        .maybeSingle();
      if (existingRow?.trading_layer_trader_id) {
        traderId = String(existingRow.trading_layer_trader_id);
        externalTraderId = existingRow.trading_layer_external_trader_id
          ? String(existingRow.trading_layer_external_trader_id)
          : null;
      }
    }

    // If unknown, list traders and pick the one matching this MT5 login or the user's email.
    if (!traderId) {
      const tradersRes = await fetchWithTimeout(
        `${TRADING_LAYER_BASE}/api/v1/traders?limit=200`,
        { method: "GET", headers: tlHeaders },
        15000,
      );
      const tradersJson = await readJson(tradersRes);
      if (tradersRes.status === 401 || tradersRes.status === 403) {
        return json(502, {
          success: false,
          step: "list_traders",
          error: "TL_AUTH_FAILED",
          tradingLayerStatus: tradersRes.status,
        });
      }
      if (tradersRes.ok) {
        const list: any[] = Array.isArray(tradersJson?.data)
          ? tradersJson.data
          : Array.isArray(tradersJson?.data?.items)
          ? tradersJson.data.items
          : Array.isArray(tradersJson?.items)
          ? tradersJson.items
          : [];
        const userEmail = (await supabase.auth.getUser()).data.user?.email?.toLowerCase() ?? "";
        const match = list.find((t) => {
          const tLogin = String(t?.mt5?.login ?? t?.mt5Login ?? "");
          const tName = String(t?.displayName ?? t?.display_name ?? "").toLowerCase();
          return (
            (account_number && tLogin === String(account_number)) ||
            (userEmail && tName === userEmail)
          );
        }) ?? null;
        if (match) {
          traderId = String(match.traderId ?? match.trader_id ?? match.id ?? "");
          externalTraderId = match.externalTraderId
            ? String(match.externalTraderId)
            : match.external_trader_id
            ? String(match.external_trader_id)
            : null;
        }
      }
    }

    if (!traderId) {
      return json(502, {
        success: false,
        step: "resolve_trader",
        error: "TL_TRADER_NOT_FOUND",
        message:
          "Trading Layer account mapping was not found. Please reconnect your MT5 account.",
        tradingLayerStatus: 404,
      });
    }

    // From here on, the path {accountId} = traderId.
    const accountId = traderId;


    // Disconnect mode — DELETE upstream credentials, then remove local row.
    if (mode === "disconnect") {
      const delRes = await fetchWithTimeout(
        `${TRADING_LAYER_BASE}/api/v1/accounts/${accountId}/mt5-credentials`,
        { method: "DELETE", headers: tlHeaders },
        15000,
      );
      const delJson = await readJson(delRes);

      if (delRes.status === 401 || delRes.status === 403) {
        return json(502, {
          success: false,
          step: "mt5_credentials_delete",
          error: "TL_AUTH_FAILED",
          message: "Trading Layer rejected the configured credentials.",
          tradingLayerStatus: delRes.status,
        });
      }
      // 404 = already disconnected upstream; treat as success.
      if (!delRes.ok && delRes.status !== 404) {
        return json(502, {
          success: false,
          step: "mt5_credentials_delete",
          error: "Failed to remove MT5 credentials in Trading Layer.",
          tradingLayerStatus: delRes.status,
          tradingLayerResponse: delJson,
        });
      }

      const { error: delLocalError } = await supabase
        .from("user_mt_accounts")
        .delete()
        .eq("user_id", userId)
        .eq("platform", "mt5");
      if (delLocalError) {
        return json(500, {
          success: false,
          step: "remove_connected_account",
          error: delLocalError.message,
        });
      }

      return json(200, {
        success: true,
        mode,
        accountId,
        tradingLayerStatus: delRes.status,
      });
    }


    // 3. Test the form credentials (with retry on transient 5xx from Cloudflare)
    let testRes!: Response;
    let testJson: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      testRes = await fetchWithTimeout(
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
      testJson = await readJson(testRes);
      if (testRes.status !== 502 && testRes.status !== 503 && testRes.status !== 504) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }

    // Any non-200 from Trading Layer is not automatically invalid credentials.
    // Only a Trading Layer 422 proves the submitted MT5 credentials are invalid.
    if (testRes.status !== 200) {
      if (testRes.status === 401 || testRes.status === 403) {
        return json(502, {
          success: false,
          step: "mt5_credentials_test",
          error: "TL_AUTH_FAILED",
          message: "Trading Layer rejected the configured credentials.",
          tradingLayerStatus: testRes.status,
        });
      }
      if (testRes.status === 404) {
        return json(502, {
          success: false,
          step: "mt5_credentials_test",
          error: "TL_TRADER_NOT_FOUND",
          message: "Trading Layer account mapping was not found. Please reconnect your MT5 account.",
          tradingLayerStatus: testRes.status,
          trading_layer_trader_id: traderId,
        });
      }
      const retryable = isRetryableTradingLayerFailure(testRes.status, testJson);
      if (retryable) {
        const retryAfter = retryAfterSeconds(testJson) ?? 60;
        return json(200, {
          success: false,
          step: "mt5_credentials_test",
          error: `Trading Layer is temporarily unavailable. Please retry in ${retryAfter} seconds.`,
          tradingLayerStatus: testRes.status,
          tradingLayerResponse: testJson,
          retryable: true,
          retryAfter,
        });
      }

      return json(200, {
        success: false,
        step: "mt5_credentials_test",
        error: testRes.status === 422
          ? "Invalid MT5 credentials. Please check login, password and server."
          : "Trading Layer could not validate the MT5 credentials.",
        tradingLayerStatus: testRes.status,
        tradingLayerResponse: testJson,
      });
    }


    // 5. Strict shape check
    // Trading Layer semantics:
    //   validated === true  -> the login/password/server combination is CORRECT
    //   connected           -> live runtime session attached (transient state, not credential validity)
    // We only require validated + an account payload with matching login.
    const data = testJson?.data;
    const validated = data?.validated === true;
    const account = data?.account;

    if (!validated || !account) {
      return json(422, {
        success: false,
        step: "mt5_credentials_test",
        error: "Invalid MT5 credentials. Please check login, password and server.",
        tradingLayerStatus: testRes.status,
        tradingLayerResponse: testJson,
      });
    }

    // 6. Login must match what the user submitted
    if (String(account.login) !== String(account_number)) {
      return json(422, {
        success: false,
        step: "mt5_credentials_test",
        error: "Account mismatch: Trading Layer returned a different MT5 login than the one submitted.",
        tradingLayerStatus: testRes.status,
        tradingLayerResponse: testJson,
      });
    }

    // 7. Test mode — stop here
    if (mode === "test") {
      return json(200, {
        success: true,
        mode,
        accountId,
        account,
        tradingLayerStatus: testRes.status,
        tradingLayerResponse: testJson,
      });
    }

    // 8. Connect mode — persist credentials in Trading Layer
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
    const persistJson = await readJson(persistRes);
    if (!persistRes.ok) {
      if (persistRes.status === 401 || persistRes.status === 403) {
        return json(502, {
          success: false,
          step: "mt5_credentials_save",
          error: "TL_AUTH_FAILED",
          message: "Trading Layer rejected the configured credentials.",
          tradingLayerStatus: persistRes.status,
        });
      }
      if (persistRes.status === 404) {
        return json(502, {
          success: false,
          step: "mt5_credentials_save",
          error: "TL_TRADER_NOT_FOUND",
          message: "Trading Layer account mapping was not found. Please reconnect your MT5 account.",
          tradingLayerStatus: persistRes.status,
          trading_layer_trader_id: traderId,
        });
      }
      return json(502, {
        success: false,
        step: "mt5_credentials_save",
        error: "Credentials validated but failed to save in Trading Layer.",
        tradingLayerStatus: persistRes.status,
        tradingLayerResponse: persistJson,
      });
    }


    // 8b. Fetch credential status (best-effort — non-fatal).
    let credentialStatus: string | null = null;
    try {
      const statusRes = await fetchWithTimeout(
        `${TRADING_LAYER_BASE}/api/v1/accounts/${accountId}/mt5-credentials/status`,
        { method: "GET", headers: tlHeaders },
        10000,
      );
      const statusJson = await readJson(statusRes);
      if (statusRes.ok) {
        credentialStatus =
          statusJson?.data?.status ??
          statusJson?.data?.credentialStatus ??
          (statusJson?.data?.connected ? "connected" : "validated");
      }
    } catch (_e) { /* ignore */ }

    // Refresh externalTraderId from the test response when available.
    const resolvedExternalTraderId =
      externalTraderId ??
      account?.externalTraderId ??
      account?.external_trader_id ??
      null;


    // 9. Persist locally — never store the password.
    const nowIso = new Date().toISOString();
    const { data: savedRow, error: saveError } = await supabase
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
          trading_layer_account_id: ownerAccountId ? String(ownerAccountId) : String(accountId),
          trading_layer_trader_id: String(traderId),
          trading_layer_external_trader_id: resolvedExternalTraderId ? String(resolvedExternalTraderId) : null,
          credential_status: credentialStatus ?? "validated",
          last_verified_at: nowIso,
          last_tl_error_code: null,
          investor_password_encrypted: null,
          last_synced_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id,platform,login,server_name" },
      )
      .select("id, user_id, login, server_name, status, metaapi_account_id, trading_layer_account_id, trading_layer_trader_id, trading_layer_external_trader_id, credential_status, last_verified_at, last_synced_at")
      .single();

    if (saveError || !savedRow) {
      return json(500, {
        success: false,
        step: "save_connected_account",
        error: saveError?.message ?? "Failed to save the connected account locally.",
        tradingLayerStatus: testRes.status,
      });
    }

    // Per-connected-account broker symbol catalogue sync. Fire-and-forget so
    // the connect flow stays fast; the catalogue resolves asynchronously and
    // the Order Ticket gates BUY/SELL on its readiness via the
    // account-specific resolver in get-terminal-execution-eligibility.
    try {
      await supabase
        .from("user_mt_accounts")
        .update({
          symbol_catalogue_status: "syncing",
          symbol_catalogue_synced_at: null,
        })
        .eq("id", savedRow.id);

      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const fnUrl = `${supabaseUrl}/functions/v1/sync-broker-symbol-catalog`;
      fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          user_id: userId,
          local_mt_account_id: savedRow.id,
          trading_layer_account_id: ownerAccountId
            ? String(ownerAccountId)
            : String(accountId),
          trading_layer_trader_id: String(traderId),
          mt5_login: String(account_number),
          mt5_server: server,
          sync_type: "post_connect_full_catalogue",
        }),
      }).catch((err) =>
        console.warn("post-connect catalogue sync invocation failed:", err),
      );
    } catch (err) {
      console.warn("post-connect catalogue sync setup failed:", err);
    }

    return json(200, {
      success: true,
      step: "account_saved",
      message: "MT5 account connected successfully.",
      mode,
      accountId,
      trading_layer_account_id: ownerAccountId ? String(ownerAccountId) : String(accountId),
      trading_layer_trader_id: String(traderId),
      trading_layer_external_trader_id: resolvedExternalTraderId ? String(resolvedExternalTraderId) : null,
      credential_status: credentialStatus ?? "validated",
      account,
      savedRow,
      symbol_catalogue_status: "syncing",
      tradingLayerStatus: testRes.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("connect-mt5-v2 error:", msg);
    return json(500, { success: false, error: `Trading Layer connectivity error: ${msg}` });
  }
});
