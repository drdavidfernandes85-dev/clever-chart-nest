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

function toSymbolItem(item: any) {
  const name = item?.name || item?.symbol || "";

  if (!name) return null;

  return {
    name,
    brokerSymbol: name,
    displayName: name,
    path: item.path || "",
    description: item.description || "",
    visible: item.visible ?? null,
    digits: item.digits ?? null,
    point: item.point ?? null,
    tradeMode: item.trade_mode ?? item.tradeMode ?? null,
    tradeExecutionMode: item.trade_exemode ?? item.tradeExecutionMode ?? null,
    tradeCalcMode: item.trade_calc_mode ?? item.tradeCalcMode ?? null,
    contractSize: item.trade_contract_size ?? item.contractSize ?? null,
    tickValue: item.trade_tick_value ?? item.tickValue ?? null,
    tickSize: item.trade_tick_size ?? item.tickSize ?? null,
    tickValueProfit: item.trade_tick_value_profit ?? null,
    tickValueLoss: item.trade_tick_value_loss ?? null,
    volumeMin: item.volume_min ?? item.volumeMin ?? null,
    volumeMax: item.volume_max ?? item.volumeMax ?? null,
    volumeStep: item.volume_step ?? item.volumeStep ?? null,
    fillingMode: item.filling_mode ?? item.fillingMode ?? null,
    orderMode: item.order_mode ?? item.orderMode ?? null,
    currencyBase: item.currency_base ?? null,
    currencyProfit: item.currency_profit ?? null,
    currencyMargin: item.currency_margin ?? null,
    raw: item,
  };
}

function uniqueSymbols(symbols: any[]) {
  const map = new Map<string, any>();

  for (const symbol of symbols) {
    if (!symbol?.name) continue;
    map.set(String(symbol.name).toUpperCase(), symbol);
  }

  return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function fetchTradingLayer(path: string) {
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

    const limit = Math.min(Number(body.limit || 1000), 1000);
    const search = String(body.search || "").trim();
    const selectedSymbolRaw = String(body.selectedSymbol || "").trim();
    const selectedSymbol = normalizeSymbol(selectedSymbolRaw);
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

    let accountId: string | null = null;
    let accountSource = "database";

    const { data: linkedAccount, error: linkedError } = await supabase
      .from("user_mt5_accounts")
      .select("id, trading_layer_trader_id, account_number, server, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkedError) {
      return json(
        {
          success: false,
          step: "database_lookup",
          error: linkedError.message,
        },
        500,
      );
    }

    if (linkedAccount?.trading_layer_trader_id) {
      accountId = linkedAccount.trading_layer_trader_id;
    }

    // Fallback: recover accountId from Trading Layer tenant if DB row is missing.
    // The docs say ownerAccount.accountId is used as {accountId} on account operation routes.
    if (!accountId) {
      const tenant = await fetchTradingLayer("/api/v1/tenant");

      if (!tenant.ok) {
        return json(
          {
            success: false,
            step: "tenant_fallback",
            error: "No connected MT5 account found and tenant lookup failed.",
            tradingLayerStatus: tenant.status,
            raw: debug ? tenant.data : undefined,
          },
          tenant.status,
        );
      }

      const ownerAccount = tenant.data?.data?.ownerAccount;
      const mt5 = ownerAccount?.mt5;

      if (ownerAccount?.accountId && mt5?.status === "connected") {
        accountId = ownerAccount.accountId;
        accountSource = "tenant_fallback";

        await supabase.from("user_mt5_accounts").upsert(
          {
            user_id: user.id,
            trading_layer_trader_id: ownerAccount.accountId,
            account_number: String(mt5.login || ""),
            server: String(mt5.server || ""),
            encrypted_password: null,
            status: "connected",
            last_synced: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,account_number,server",
          },
        );
      }
    }

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

    const allSymbols: any[] = [];
    const attempts: any[] = [];

    // Main list call. Do NOT force visible=true. Let Trading Layer return all available symbols for the account.
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("sort", "name");
    params.set("order", "asc");

    if (search) {
      params.set("search", search);
    }

    const listPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols?${params.toString()}`;
    const listRes = await fetchTradingLayer(listPath);

    attempts.push({
      type: "list",
      path: listPath,
      status: listRes.status,
      ok: listRes.ok,
      count: Array.isArray(listRes.data?.data) ? listRes.data.data.length : null,
    });

    if (listRes.ok && Array.isArray(listRes.data?.data)) {
      for (const rawSymbol of listRes.data.data) {
        const mapped = toSymbolItem(rawSymbol);
        if (mapped) allSymbols.push(mapped);
      }
    }

    // If a selected symbol exists, validate it directly using /symbols/{symbol}.
    // This avoids blocking trades just because the full list failed or was not loaded.
    let selectedSymbolInfo: any = null;
    let selectedSymbolValid = false;

    if (selectedSymbol) {
      const exactPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/${encodeURIComponent(selectedSymbol)}`;
      const exactRes = await fetchTradingLayer(exactPath);

      attempts.push({
        type: "exact_symbol",
        path: exactPath,
        status: exactRes.status,
        ok: exactRes.ok,
      });

      if (exactRes.ok && exactRes.data?.data) {
        selectedSymbolInfo = toSymbolItem(exactRes.data.data);
        selectedSymbolValid = !!selectedSymbolInfo;

        if (selectedSymbolInfo) {
          allSymbols.push(selectedSymbolInfo);
        }
      }
    }

    const symbols = uniqueSymbols(allSymbols);

    const normalizedSelected = selectedSymbol;
    const existsInList = normalizedSelected
      ? symbols.some((s) => normalizeSymbol(s.name) === normalizedSelected)
      : false;

    selectedSymbolValid = selectedSymbolValid || existsInList;

    if (symbols.length === 0 && !selectedSymbolValid) {
      return json(
        {
          success: false,
          step: "symbols_load",
          error: "Broker symbols unavailable. Trading Layer returned no symbols for this connected account.",
          accountId,
          accountSource,
          selectedSymbol,
          selectedSymbolValid: false,
          attempts,
          raw: debug ? listRes.data : undefined,
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
        symbolsLoaded: symbols.length > 0,
        count: symbols.length,
        symbols,
        selectedSymbol,
        selectedSymbolValid,
        selectedSymbolInfo,
        attempts,
        meta: listRes.data?.meta || null,
        raw: debug
          ? {
              list: listRes.data,
            }
          : undefined,
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
