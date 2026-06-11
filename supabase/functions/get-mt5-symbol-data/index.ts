// ============================================================
// DISPLAY-ONLY ENDPOINT — NOT FOR EXECUTION.
// ------------------------------------------------------------
// Permitted uses ONLY:
//   - Market Watch list / Bid-Ask board
//   - Quotes / charts / terminal display
//   - Balance / equity / positions display
// MUST NEVER be imported or invoked by:
//   - execution instrument resolution
//   - order eligibility decisions
//   - full pre-trade validation
//   - server-side execution price-of-record
//   - any live mutation path (submit/close/modify/cancel)
// Authoritative execution resolver: get-terminal-execution-eligibility.
// Authoritative submission path:    submit-best-execution-order.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeSymbol(value: string): string {
  return String(value || "")
    .trim()
    .replace("/", "")
    .replace("-", "")
    .replace(" ", "")
    .toUpperCase();
}

function mapSymbolInfo(item: any) {
  if (!item?.name) return null;
  return {
    name: item.name,
    brokerSymbol: item.name,
    displayName: item.name,
    description: item.description || "",
    digits: item.digits ?? null,
    point: item.point ?? null,
    contractSize: item.trade_contract_size ?? null,
    tickValue: item.trade_tick_value ?? null,
    tickSize: item.trade_tick_size ?? null,
    volumeMin: item.volume_min ?? null,
    volumeMax: item.volume_max ?? null,
    volumeStep: item.volume_step ?? null,
    currencyBase: item.currency_base ?? null,
    currencyProfit: item.currency_profit ?? null,
    currencyMargin: item.currency_margin ?? null,
    raw: item,
  };
}

async function tlGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TRADING_LAYER_KEY}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TRADING_LAYER_KEY) {
      return json({ success: false, step: "env", error: "Missing TRADING_LAYER_API_KEY" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, step: "auth", error: "Missing Authorization header." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const selectedSymbol = normalizeSymbol(body.selectedSymbol || "EURUSD");
    const debug = body.debug === true;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, step: "auth", error: "Unauthorized." }, 401);
    }

    const { data: linkedAccount, error: accountError } = await supabase
      .from("user_mt_accounts")
      .select("trading_layer_trader_id, login, server_name, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError) {
      return json({ success: false, step: "database_lookup", error: accountError.message }, 500);
    }

    let accountId = linkedAccount?.trading_layer_trader_id || null;
    let accountSource = "database";

    // Auto-heal removed: tenant `ownerAccount.accountId` is NOT a valid
    // Trading Layer trader ID. `connect-mt5-v2` is the only writer.


    if (!accountId) {
      return json({ success: false, step: "account_lookup", error: "No connected MT5 account found." }, 404);
    }

    const attempts: any[] = [];
    const exactPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/${encodeURIComponent(selectedSymbol)}`;
    const exactRes = await tlGet(exactPath);
    attempts.push({ type: "exact_symbol", path: exactPath, status: exactRes.status, ok: exactRes.ok });

    let selectedSymbolInfo: any = null;
    let selectedSymbolValid = false;
    if (exactRes.ok && exactRes.data?.data) {
      selectedSymbolInfo = mapSymbolInfo(exactRes.data.data);
      selectedSymbolValid = !!selectedSymbolInfo;
    }

    let tick: any = null;
    if (selectedSymbolValid) {
      const tickPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/${encodeURIComponent(selectedSymbol)}/tick`;
      const tickRes = await tlGet(tickPath);
      attempts.push({ type: "tick", path: tickPath, status: tickRes.status, ok: tickRes.ok });
      if (tickRes.ok && tickRes.data?.data) tick = tickRes.data.data;
    }

    const symbols = selectedSymbolInfo ? [selectedSymbolInfo] : [];

    if (!selectedSymbolValid) {
      const isRateLimited = exactRes.status === 429;
      return json({
        success: false,
        step: isRateLimited ? "rate_limited" : "symbol_validation",
        error: isRateLimited
          ? "Broker API rate limit hit — retrying shortly."
          : `${selectedSymbol} is not available on this connected MT5 account.`,
        rateLimited: isRateLimited,
        accountId,
        accountSource,
        selectedSymbol,
        // Don't claim the symbol is invalid when the broker just rate-limited us.
        selectedSymbolValid: isRateLimited ? null : false,
        symbolsLoaded: false,
        count: 0,
        symbols: [],
        attempts,
        raw: debug ? { exactSymbol: exactRes.data } : undefined,
      }, isRateLimited ? 429 : 400);
    }

    return json({
      success: true,
      step: "symbol_loaded",
      accountId,
      accountSource,
      selectedSymbol,
      selectedSymbolValid: true,
      selectedSymbolInfo,
      tick,
      symbolsLoaded: true,
      count: symbols.length,
      symbols,
      attempts,
      timestamp: new Date().toISOString(),
    }, 200);
  } catch (err) {
    return json({
      success: false,
      step: "unhandled_exception",
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
