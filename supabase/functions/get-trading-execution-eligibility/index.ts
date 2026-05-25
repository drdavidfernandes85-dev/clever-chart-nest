// Resolve Trading Layer execution eligibility for a connected MT5 account.
//
// Performs server-side reads of:
//   GET /api/v1/traders/{traderId}                 → account.trade_mode
//   GET /api/v1/accounts/{traderId}/symbols        → broker symbols + trade_mode
//
// Upserts the symbol list into `broker_symbol_catalog` so the rest of the
// platform can find the exact broker symbol (e.g. XAUUSD+) to use for live
// execution instead of the canonical/display symbol.
//
// Returns sanitized JSON only — never exposes API keys, MT5 passwords, or
// raw upstream Authorization headers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TRADABLE_MODES = new Set([
  "full",
  "long_only",
  "short_only",
  "close_only",
  "enabled",
  "tradable",
  "full_access",
  "0", // some brokers return numeric "0" for full access in MT5 SYMBOL_TRADE_MODE_FULL
  "4",
]);

function isTradable(mode: unknown): boolean {
  if (mode == null) return false;
  const s = String(mode).trim().toLowerCase();
  if (!s) return false;
  if (s === "disabled" || s === "no" || s === "false") return false;
  return TRADABLE_MODES.has(s) || s.includes("full") || s.includes("long") ||
    s.includes("short");
}

function canonicalize(sym: string): string {
  return String(sym || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function pick(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const v = k.split(".").reduce<any>(
      (acc, kk) => (acc && typeof acc === "object" ? acc[kk] : undefined),
      obj,
    );
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }
  if (!TRADING_LAYER_KEY) {
    return json({ success: false, error: "Missing TRADING_LAYER_API_KEY" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseService = createClient(supabaseUrl, serviceKey);

  const { data: userData } = await supabaseUser.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return json({ success: false, error: "Unauthorized" }, 401);

  let body: any = {};
  try {
    body = await req.json();
  } catch { /* allow empty */ }
  const displaySymbol: string = String(body?.symbol ?? "").trim();
  const refreshCatalog: boolean = body?.refresh !== false;
  const symbolCanonical = canonicalize(displaySymbol);

  // Resolve active mapping for this user.
  const mapping = await resolveActiveMtMapping(supabaseService, uid);
  if (!mapping?.traderId) {
    return json({
      success: false,
      step: "mapping",
      eligibility: "unknown",
      blockedReason: "No connected MT5 mapping",
    });
  }
  const traderId: string = mapping.traderId;

  // 1) Account trade mode
  let accountTradeMode: string | null = null;
  let accountTradeEligible = false;
  let traderFetchError: string | null = null;
  try {
    const r = await fetch(`${BASE_URL}/api/v1/traders/${traderId}`, {
      headers: {
        Authorization: `Bearer ${TRADING_LAYER_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const txt = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
    if (!r.ok) {
      traderFetchError = `trader_fetch_${r.status}`;
    } else {
      accountTradeMode = pick(parsed, [
        "data.account.trade_mode",
        "account.trade_mode",
        "data.trade_mode",
        "trade_mode",
      ]);
      if (accountTradeMode != null) {
        accountTradeMode = String(accountTradeMode);
        accountTradeEligible = isTradable(accountTradeMode);
      }
    }
  } catch (e) {
    traderFetchError = (e as Error).message || "trader_fetch_failed";
  }

  // 2) Symbols catalogue
  let symbolsFetchError: string | null = null;
  let upsertedCount = 0;
  let brokerSymbol: string | null = null;
  let symbolTradeMode: string | null = null;
  let symbolTradeEligible = false;

  if (refreshCatalog) {
    try {
      const r = await fetch(
        `${BASE_URL}/api/v1/accounts/${traderId}/symbols`,
        {
          headers: {
            Authorization: `Bearer ${TRADING_LAYER_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );
      const txt = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
      if (!r.ok) {
        symbolsFetchError = `symbols_fetch_${r.status}`;
      } else {
        const list: any[] = Array.isArray(parsed?.data)
          ? parsed.data
          : Array.isArray(parsed)
            ? parsed
            : [];
        const now = new Date().toISOString();
        const rows = list.map((s) => {
          const broker = String(
            pick(s, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "",
          ).trim();
          const canonical = canonicalize(broker);
          const tm = pick(s, ["trade_mode", "tradeMode"]);
          return {
            trading_layer_trader_id: traderId,
            mt5_login: mapping.login ? String(mapping.login) : null,
            mt5_server: mapping.server ?? null,
            display_symbol: canonical,
            canonical_symbol: canonical,
            broker_symbol: broker,
            description: pick(s, ["description", "desc"]) ?? null,
            asset_class: pick(s, ["assetClass", "asset_class", "category"]) ?? null,
            digits: Number(pick(s, ["digits"])) || null,
            contract_size: Number(pick(s, ["contractSize", "contract_size"])) || null,
            trade_mode: tm != null ? String(tm) : null,
            trade_eligible: isTradable(tm),
            source: "trading_layer_symbols",
            last_synced_at: now,
            raw_metadata: null,
          };
        }).filter((r) => r.broker_symbol);
        if (rows.length > 0) {
          const { error: upErr } = await supabaseService
            .from("broker_symbol_catalog")
            .upsert(rows, { onConflict: "trading_layer_trader_id,broker_symbol" });
          if (!upErr) upsertedCount = rows.length;
        }
      }
    } catch (e) {
      symbolsFetchError = (e as Error).message || "symbols_fetch_failed";
    }
  }

  // 3) Resolve broker symbol for the requested display symbol from catalogue.
  if (symbolCanonical) {
    const { data: catRows } = await supabaseService
      .from("broker_symbol_catalog")
      .select("broker_symbol,canonical_symbol,trade_mode,trade_eligible,last_synced_at")
      .eq("trading_layer_trader_id", traderId);
    const candidates = (catRows ?? []).filter((r: any) => {
      const c = canonicalize(r.canonical_symbol || r.broker_symbol);
      return c === symbolCanonical || c.startsWith(symbolCanonical) ||
        symbolCanonical.startsWith(c);
    });
    // Prefer exact canonical match first.
    const exact = candidates.find((r: any) =>
      canonicalize(r.canonical_symbol || r.broker_symbol) === symbolCanonical
    );
    const chosen = exact ?? candidates[0] ?? null;
    if (chosen) {
      brokerSymbol = chosen.broker_symbol;
      symbolTradeMode = chosen.trade_mode ?? null;
      symbolTradeEligible = !!chosen.trade_eligible;
    }
  }

  let eligibility: "eligible" | "blocked" | "unknown" = "unknown";
  let blockedReason: string | null = null;
  if (traderFetchError || symbolsFetchError) {
    eligibility = "unknown";
    blockedReason = traderFetchError || symbolsFetchError;
  } else if (accountTradeMode != null && !accountTradeEligible) {
    eligibility = "blocked";
    blockedReason = "account_trade_mode_blocked";
  } else if (symbolCanonical && !brokerSymbol) {
    eligibility = "unknown";
    blockedReason = "broker_symbol_unresolved";
  } else if (brokerSymbol && symbolTradeMode != null && !symbolTradeEligible) {
    eligibility = "blocked";
    blockedReason = "symbol_trade_mode_blocked";
  } else if (accountTradeEligible && (brokerSymbol == null || symbolTradeEligible)) {
    eligibility = symbolCanonical ? (symbolTradeEligible ? "eligible" : "unknown") : "eligible";
    if (eligibility === "unknown") blockedReason = "symbol_trade_mode_unknown";
  }

  return json({
    success: true,
    traderId,
    accountTradeMode,
    accountTradeEligible,
    displaySymbol: symbolCanonical || null,
    brokerSymbol,
    symbolTradeMode,
    symbolTradeEligible,
    eligibility,
    blockedReason,
    catalogUpsertedCount: upsertedCount,
    checkedAt: new Date().toISOString(),
    diagnostics: {
      traderFetchError,
      symbolsFetchError,
    },
  });
});
