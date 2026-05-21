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
    // 1. Get tenant
    const tenantRes = await fetchWithTimeout(
      `${TRADING_LAYER_BASE}/api/v1/tenant`,
      { method: "GET", headers: tlHeaders },
      15000,
    );
    const tenantJson = await readJson(tenantRes);

    if (tenantRes.status === 401 || tenantRes.status === 403) {
      return json(502, {
        success: false,
        step: "tenant",
        error: "TL_AUTH_FAILED",
        message: "Trading Layer rejected the configured credentials.",
        tradingLayerStatus: tenantRes.status,
      });
    }
    if (!tenantRes.ok) {
      return json(502, {
        success: false,
        step: "tenant",
        error: "Failed to load Trading Layer tenant.",
        tradingLayerStatus: tenantRes.status,
        tradingLayerResponse: tenantJson,
      });
    }

    // 2. Extract ownerAccount.accountId
    const accountId = tenantJson?.data?.ownerAccount?.accountId;
    if (!accountId) {
      return json(502, {
        success: false,
        step: "tenant",
        error: "Trading Layer tenant has no ownerAccount.accountId.",
        tradingLayerStatus: tenantRes.status,
        tradingLayerResponse: tenantJson,
      });
    }

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
      return json(502, {
        success: false,
        step: "mt5_credentials_save",
        error: "Credentials validated but failed to save in Trading Layer.",
        tradingLayerStatus: persistRes.status,
        tradingLayerResponse: persistJson,
      });
    }

    // 9. Persist locally — never store the password. Strict: a save failure
    // means the user will not appear connected on the dashboard, so surface it.
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
          investor_password_encrypted: null,
          last_synced_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id,platform,login,server_name" },
      )
      .select("id, user_id, login, server_name, status, metaapi_account_id, last_synced_at")
      .single();

    if (saveError || !savedRow) {
      return json(500, {
        success: false,
        step: "save_connected_account",
        error: saveError?.message ?? "Failed to save the connected account locally.",
        tradingLayerStatus: testRes.status,
        tradingLayerResponse: testJson,
        persistResponse: persistJson,
      });
    }

    return json(200, {
      success: true,
      step: "account_saved",
      message: "Account successfully linked!",
      mode,
      accountId,
      trading_layer_trader_id: accountId,
      account,
      savedRow,
      tradingLayerStatus: testRes.status,
      tradingLayerResponse: testJson,
      persistResponse: persistJson,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("connect-mt5-v2 error:", msg);
    return json(500, { success: false, error: `Trading Layer connectivity error: ${msg}` });
  }
});
