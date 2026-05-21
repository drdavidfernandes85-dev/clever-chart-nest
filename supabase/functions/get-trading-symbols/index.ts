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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
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
    path: item.path || "",
    description: item.description || "",
    visible: item.visible ?? null,
    digits: item.digits ?? null,
    point: item.point ?? null,
    tradeMode: item.trade_mode ?? null,
    tradeExecutionMode: item.trade_exemode ?? null,
    tradeCalcMode: item.trade_calc_mode ?? null,
    contractSize: item.trade_contract_size ?? null,
    tickValue: item.trade_tick_value ?? null,
    tickSize: item.trade_tick_size ?? null,
    tickValueProfit: item.trade_tick_value_profit ?? null,
    tickValueLoss: item.trade_tick_value_loss ?? null,
    volumeMin: item.volume_min ?? null,
    volumeMax: item.volume_max ?? null,
    volumeStep: item.volume_step ?? null,
    fillingMode: item.filling_mode ?? null,
    orderMode: item.order_mode ?? null,
    currencyBase: item.currency_base ?? null,
    currencyProfit: item.currency_profit ?? null,
    currencyMargin: item.currency_margin ?? null,
    raw: item,
  };
}

async function tradingLayerGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TRADING_LAYER_KEY}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!TRADING_LAYER_KEY) {
      return json(
        {
          success: false,
          step: "env",
          error: "Missing TRADING_LAYER_API_KEY",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json(
        {
          success: false,
          step: "auth",
          error: "Missing Authorization header.",
        },
        401,
      );
    }

    const body = await req.json().catch(() => ({}));

    const selectedSymbol = normalizeSymbol(body.selectedSymbol || "EURUSD");
    const debug = body.debug === true;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json(
        {
          success: false,
          step: "auth",
          error: "Unauthorized.",
          details: debug ? authError : undefined,
        },
        401,
      );
    }

    const { data: linkedAccount, error: accountError } = await supabase
      .from("user_mt5_accounts")
      .select("trading_layer_trader_id, account_number, server, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError) {
      return json(
        {
          success: false,
          step: "database_lookup",
          error: accountError.message,
        },
        500,
      );
    }

    let accountId = linkedAccount?.trading_layer_trader_id || null;
    let accountSource = "database";

    // Auto-heal removed: tenant `ownerAccount.accountId` is NOT a valid
    // Trading Layer trader ID. `connect-mt5-v2` is the only writer.


    if (!accountId) {
      return json(
        {
          success: false,
          step: "account_lookup",
          error: "No connected MT5 account found.",
        },
        404,
      );
    }

    const attempts: any[] = [];

    // Exact symbol validation. This is the key fix.
    const exactSymbolPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/${encodeURIComponent(selectedSymbol)}`;
    const exactSymbolRes = await tradingLayerGet(exactSymbolPath);

    attempts.push({
      type: "exact_symbol",
      path: exactSymbolPath,
      status: exactSymbolRes.status,
      ok: exactSymbolRes.ok,
    });

    let selectedSymbolInfo = null;
    let selectedSymbolValid = false;

    if (exactSymbolRes.ok && exactSymbolRes.data?.data) {
      selectedSymbolInfo = mapSymbolInfo(exactSymbolRes.data.data);
      selectedSymbolValid = !!selectedSymbolInfo;
    }

    // Latest tick for current price.
    let tick = null;

    if (selectedSymbolValid) {
      const tickPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/${encodeURIComponent(selectedSymbol)}/tick`;
      const tickRes = await tradingLayerGet(tickPath);

      attempts.push({
        type: "tick",
        path: tickPath,
        status: tickRes.status,
        ok: tickRes.ok,
      });

      if (tickRes.ok && tickRes.data?.data) {
        tick = tickRes.data.data;
      }
    }

    // Build a small default list around the current broker account.
    // We validate common broker symbols one by one.
    const commonSymbols = [selectedSymbol, "EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "GBPCAD", "US30", "NAS100"];

    const uniqueCommonSymbols = Array.from(new Set(commonSymbols.map(normalizeSymbol)));

    const symbols: any[] = [];

    for (const sym of uniqueCommonSymbols) {
      const path = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/${encodeURIComponent(sym)}`;
      const res = await tradingLayerGet(path);

      attempts.push({
        type: "common_symbol",
        symbol: sym,
        status: res.status,
        ok: res.ok,
      });

      if (res.ok && res.data?.data) {
        const mapped = mapSymbolInfo(res.data.data);
        if (mapped) symbols.push(mapped);
      }
    }

    const dedupedSymbols = Array.from(new Map(symbols.map((s) => [s.name, s])).values());

    if (!selectedSymbolValid) {
      return json(
        {
          success: false,
          step: "symbol_validation",
          error: `${selectedSymbol} is not available on this connected MT5 account.`,
          accountId,
          accountSource,
          selectedSymbol,
          selectedSymbolValid: false,
          symbolsLoaded: dedupedSymbols.length > 0,
          count: dedupedSymbols.length,
          symbols: dedupedSymbols,
          attempts,
          raw: debug
            ? {
                exactSymbol: exactSymbolRes.data,
              }
            : undefined,
        },
        400,
      );
    }

    return json(
      {
        success: true,
        step: "symbols_loaded",
        accountId,
        accountSource,
        selectedSymbol,
        selectedSymbolValid: true,
        selectedSymbolInfo,
        tick,
        symbolsLoaded: dedupedSymbols.length > 0,
        count: dedupedSymbols.length,
        symbols: dedupedSymbols,
        attempts,
        timestamp: new Date().toISOString(),
      },
      200,
    );
  } catch (err) {
    return json(
      {
        success: false,
        step: "unhandled_exception",
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});
