// Shared broker-symbol + Trading Layer trade-mode resolver.
//
// Used by every backend function that submits a real Trading Layer mutation
// (market order, pending order, cancel, close, modify SL/TP, partial close,
// reconciliation).
//
// Reads from `broker_symbol_catalog` populated by `get-trading-execution-eligibility`.
// Fails closed when the broker symbol is unresolved, the cached mapping is
// stale, or the account/symbol trade_mode is not tradable.
//
// Returns sanitized fields only — never exposes API keys or raw upstream
// payloads.

export const TTL_SECONDS_DEFAULT = 60 * 60; // 1 hour — symbol identity mapping
export const TRADE_MODE_TTL_SECONDS_DEFAULT = 30; // ≤30s — execution permission freshness

const TL_BASE_URL = "https://api.trading-layer.com";

const TRADABLE_MODES_SET = new Set([
  "full", "long_only", "short_only", "close_only",
  "enabled", "tradable", "full_access", "0", "4",
]);
function isTradableMode(mode: unknown): boolean {
  if (mode == null) return false;
  const s = String(mode).trim().toLowerCase();
  if (!s || s === "disabled" || s === "no" || s === "false") return false;
  return TRADABLE_MODES_SET.has(s) || s.includes("full") || s.includes("long") || s.includes("short");
}
function pickField(obj: any, paths: string[]): any {
  if (!obj || typeof obj !== "object") return null;
  for (const p of paths) {
    const v = p.split(".").reduce<any>((a, k) => (a && typeof a === "object" ? a[k] : undefined), obj);
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

export interface FreshTradeModeResult {
  ok: boolean;
  errorCode?: string;
  message?: string;
  accountTradeMode: string | null;
  accountTradeEligible: boolean;
  symbolTradeMode: string | null;
  symbolTradeEligible: boolean;
  brokerSymbol: string | null;
  accountTradeModeCheckedAt: string | null;
  symbolTradeModeCheckedAt: string | null;
}

/**
 * Refresh account.trade_mode AND symbol.trade_mode directly from Trading Layer
 * for the supplied trader + broker symbol. Always performs live HTTPS reads —
 * never trusts cache for execution permission. Upserts the latest catalogue row
 * so subsequent reads observe fresh state.
 *
 * Use this immediately before any real Trading Layer trade mutation.
 */
export async function refreshTradeModeFromTradingLayer(
  supabaseService: any,
  args: { traderId: string; brokerSymbol: string; login?: string | null; server?: string | null },
): Promise<FreshTradeModeResult> {
  const TL_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
  const empty: FreshTradeModeResult = {
    ok: false,
    accountTradeMode: null, accountTradeEligible: false,
    symbolTradeMode: null, symbolTradeEligible: false,
    brokerSymbol: args.brokerSymbol,
    accountTradeModeCheckedAt: null, symbolTradeModeCheckedAt: null,
  };
  if (!TL_KEY) return { ...empty, errorCode: "TL_API_KEY_MISSING", message: "Trading Layer key not configured." };
  if (!args.traderId) return { ...empty, errorCode: ERR_BROKER_SYMBOL_UNRESOLVED, message: "Missing trader id." };
  if (!args.brokerSymbol) return { ...empty, errorCode: ERR_BROKER_SYMBOL_UNRESOLVED, message: "Missing broker symbol." };

  const headers = { Authorization: `Bearer ${TL_KEY}`, "Content-Type": "application/json" };
  const now = new Date().toISOString();

  // 1) Account trade_mode
  let accountTradeMode: string | null = null;
  try {
    const r = await fetch(`${TL_BASE_URL}/api/v1/traders/${args.traderId}`, { headers });
    if (r.ok) {
      const parsed = await r.json().catch(() => null);
      const v = pickField(parsed, ["data.account.trade_mode", "account.trade_mode", "data.trade_mode", "trade_mode"]);
      if (v != null) accountTradeMode = String(v);
    } else {
      return { ...empty, errorCode: "ACCOUNT_FETCH_FAILED", message: `trader_fetch_${r.status}`, accountTradeModeCheckedAt: now };
    }
  } catch (e) {
    return { ...empty, errorCode: "ACCOUNT_FETCH_FAILED", message: (e as Error).message, accountTradeModeCheckedAt: now };
  }
  const accountEligible = isTradableMode(accountTradeMode);
  if (accountTradeMode != null && !accountEligible) {
    return {
      ok: false,
      errorCode: ERR_ACCOUNT_TRADE_MODE_BLOCKED,
      message: `Trading Layer reports account trading disabled (trade_mode=${accountTradeMode}).`,
      accountTradeMode, accountTradeEligible: false,
      symbolTradeMode: null, symbolTradeEligible: false,
      brokerSymbol: args.brokerSymbol,
      accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: null,
    };
  }

  // 2) Symbols catalogue — find this brokerSymbol live
  let symbolTradeMode: string | null = null;
  try {
    const r = await fetch(`${TL_BASE_URL}/api/v1/accounts/${args.traderId}/symbols`, { headers });
    if (r.ok) {
      const parsed = await r.json().catch(() => null);
      const list: any[] = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
      // Upsert the catalogue with fresh data for staleness tracking elsewhere.
      const upsertRows = list.map((s) => {
        const broker = String(pickField(s, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "").trim();
        const canonical = broker.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const tm = pickField(s, ["trade_mode", "tradeMode"]);
        return {
          trading_layer_trader_id: args.traderId,
          mt5_login: args.login ? String(args.login) : null,
          mt5_server: args.server ?? null,
          display_symbol: canonical,
          canonical_symbol: canonical,
          broker_symbol: broker,
          description: pickField(s, ["description", "desc"]) ?? null,
          asset_class: pickField(s, ["assetClass", "asset_class", "category"]) ?? null,
          digits: Number(pickField(s, ["digits"])) || null,
          contract_size: Number(pickField(s, ["contractSize", "contract_size"])) || null,
          trade_mode: tm != null ? String(tm) : null,
          trade_eligible: isTradableMode(tm),
          source: "trading_layer_symbols",
          last_synced_at: now,
        };
      }).filter((r) => r.broker_symbol);
      if (upsertRows.length > 0) {
        try {
          await supabaseService.from("broker_symbol_catalog").upsert(upsertRows, {
            onConflict: "trading_layer_trader_id,broker_symbol",
          });
        } catch { /* ignore — upsert is best-effort */ }
      }
      const match = list.find((s) => {
        const broker = String(pickField(s, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "").trim();
        return broker === args.brokerSymbol;
      });
      if (match) {
        const tm = pickField(match, ["trade_mode", "tradeMode"]);
        if (tm != null) symbolTradeMode = String(tm);
      } else {
        return {
          ok: false,
          errorCode: ERR_BROKER_SYMBOL_UNRESOLVED,
          message: `Broker symbol ${args.brokerSymbol} not present in fresh Trading Layer symbols list.`,
          accountTradeMode, accountTradeEligible: accountEligible,
          symbolTradeMode: null, symbolTradeEligible: false,
          brokerSymbol: args.brokerSymbol,
          accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
        };
      }
    } else {
      return {
        ok: false, errorCode: "SYMBOLS_FETCH_FAILED",
        message: `symbols_fetch_${r.status}`,
        accountTradeMode, accountTradeEligible: accountEligible,
        symbolTradeMode: null, symbolTradeEligible: false,
        brokerSymbol: args.brokerSymbol,
        accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
      };
    }
  } catch (e) {
    return {
      ok: false, errorCode: "SYMBOLS_FETCH_FAILED",
      message: (e as Error).message,
      accountTradeMode, accountTradeEligible: accountEligible,
      symbolTradeMode: null, symbolTradeEligible: false,
      brokerSymbol: args.brokerSymbol,
      accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
    };
  }

  const symbolEligible = isTradableMode(symbolTradeMode);
  if (symbolTradeMode != null && !symbolEligible) {
    return {
      ok: false, errorCode: ERR_SYMBOL_TRADE_MODE_BLOCKED,
      message: `Trading Layer reports symbol ${args.brokerSymbol} not currently tradable (trade_mode=${symbolTradeMode}).`,
      accountTradeMode, accountTradeEligible: accountEligible,
      symbolTradeMode, symbolTradeEligible: false,
      brokerSymbol: args.brokerSymbol,
      accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
    };
  }

  return {
    ok: true,
    accountTradeMode, accountTradeEligible: accountEligible,
    symbolTradeMode, symbolTradeEligible: symbolEligible,
    brokerSymbol: args.brokerSymbol,
    accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
  };
}

export function freshTradeModeGateResponse(
  version: string,
  result: FreshTradeModeResult,
  extra: Record<string, unknown> = {},
) {
  return {
    success: false,
    version,
    step: "trade_mode_refresh_gate",
    classification: (result.errorCode ?? ERR_ACCOUNT_TRADE_MODE_BLOCKED).toLowerCase(),
    liveOrderAttempted: false,
    liveOrderSent: false,
    brokerAccepted: false,
    error: result.errorCode,
    message: result.message,
    brokerSymbol: result.brokerSymbol,
    accountTradeMode: result.accountTradeMode,
    symbolTradeMode: result.symbolTradeMode,
    accountTradeModeCheckedAt: result.accountTradeModeCheckedAt,
    symbolTradeModeCheckedAt: result.symbolTradeModeCheckedAt,
    ...extra,
  };
}


export const ERR_ACCOUNT_TRADE_MODE_BLOCKED = "ACCOUNT_TRADE_MODE_BLOCKED";
export const ERR_SYMBOL_TRADE_MODE_BLOCKED = "SYMBOL_TRADE_MODE_BLOCKED";
export const ERR_BROKER_SYMBOL_UNRESOLVED = "BROKER_SYMBOL_UNRESOLVED";
export const ERR_BROKER_SYMBOL_MAPPING_STALE = "BROKER_SYMBOL_MAPPING_STALE";
export const ERR_BROKER_SYMBOL_MISMATCH = "BROKER_SYMBOL_MISMATCH";

export interface ResolveInput {
  userId: string;
  traderId: string;
  requestedDisplaySymbol?: string | null;
  suppliedBrokerSymbol?: string | null;
  operationType:
    | "market_order"
    | "pending_order"
    | "cancel_pending"
    | "close_position"
    | "partial_close"
    | "modify_protection"
    | "reconcile";
  ttlSeconds?: number;
}

export interface ResolveResult {
  ok: boolean;
  errorCode?: string;
  message?: string;
  displaySymbol: string | null;
  brokerSymbol: string | null;
  canonicalSymbol: string | null;
  accountTradeMode: string | null;
  symbolTradeMode: string | null;
  accountTradeEligible: boolean;
  symbolTradeEligible: boolean;
  symbolMappingSource: string | null;
  symbolMappingCheckedAt: string | null;
  catalogRowId?: string | null;
}

function canonicalize(sym: string | null | undefined): string {
  return String(sym ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function resolveEligibleBrokerSymbol(
  supabaseService: any,
  input: ResolveInput,
): Promise<ResolveResult> {
  const ttl = input.ttlSeconds ?? TTL_SECONDS_DEFAULT;
  const wantCanonical = canonicalize(input.requestedDisplaySymbol);
  const wantBroker = String(input.suppliedBrokerSymbol ?? "").trim();
  const empty: ResolveResult = {
    ok: false,
    displaySymbol: input.requestedDisplaySymbol ?? null,
    brokerSymbol: null,
    canonicalSymbol: wantCanonical || null,
    accountTradeMode: null,
    symbolTradeMode: null,
    accountTradeEligible: false,
    symbolTradeEligible: false,
    symbolMappingSource: null,
    symbolMappingCheckedAt: null,
  };

  if (!input.traderId) {
    return { ...empty, errorCode: ERR_BROKER_SYMBOL_UNRESOLVED, message: "Missing trader id" };
  }

  const { data: rows, error } = await supabaseService
    .from("broker_symbol_catalog")
    .select(
      "id, display_symbol, canonical_symbol, broker_symbol, trade_mode, trade_eligible, source, last_synced_at",
    )
    .eq("trading_layer_trader_id", input.traderId);

  if (error) {
    return { ...empty, errorCode: ERR_BROKER_SYMBOL_UNRESOLVED, message: "Catalog read failed" };
  }
  const all: any[] = Array.isArray(rows) ? rows : [];
  if (all.length === 0) {
    return {
      ...empty,
      errorCode: ERR_BROKER_SYMBOL_MAPPING_STALE,
      message:
        "Broker symbol catalog is empty for this trader. Refresh execution eligibility first.",
    };
  }

  // Pick row by supplied broker symbol first (close/modify/cancel path), then canonical.
  let chosen: any | null = null;
  if (wantBroker) {
    chosen = all.find((r) => String(r.broker_symbol).trim() === wantBroker) ?? null;
    if (!chosen && wantCanonical) {
      // Supplied broker symbol doesn't exist in current catalog.
      const fallback = all.find(
        (r) => canonicalize(r.canonical_symbol || r.broker_symbol) === wantCanonical,
      );
      if (fallback) {
        return {
          ok: false,
          errorCode: ERR_BROKER_SYMBOL_MISMATCH,
          message: `Supplied broker symbol ${wantBroker} does not match current Trading Layer catalog (${fallback.broker_symbol}). Refresh the position/order from MT5 before retrying.`,
          displaySymbol: input.requestedDisplaySymbol ?? null,
          brokerSymbol: fallback.broker_symbol,
          canonicalSymbol: wantCanonical,
          accountTradeMode: null,
          symbolTradeMode: fallback.trade_mode ?? null,
          accountTradeEligible: false,
          symbolTradeEligible: !!fallback.trade_eligible,
          symbolMappingSource: fallback.source ?? "trading_layer_symbols",
          symbolMappingCheckedAt: fallback.last_synced_at ?? null,
          catalogRowId: fallback.id ?? null,
        };
      }
    }
  }
  if (!chosen && wantCanonical) {
    // exact canonical match preferred
    chosen = all.find(
      (r) => canonicalize(r.canonical_symbol || r.broker_symbol) === wantCanonical,
    ) ?? null;
    if (!chosen) {
      // suffix/prefix tolerant fallback
      chosen = all.find((r) => {
        const c = canonicalize(r.canonical_symbol || r.broker_symbol);
        return c.startsWith(wantCanonical) || wantCanonical.startsWith(c);
      }) ?? null;
    }
  }

  if (!chosen) {
    return {
      ...empty,
      errorCode: ERR_BROKER_SYMBOL_UNRESOLVED,
      message:
        "Broker symbol could not be resolved from Trading Layer catalog. Refresh execution eligibility.",
    };
  }

  // Staleness check
  const syncedAt = chosen.last_synced_at ? Date.parse(chosen.last_synced_at) : 0;
  const ageSec = syncedAt > 0 ? (Date.now() - syncedAt) / 1000 : Infinity;
  if (ageSec > ttl) {
    return {
      ok: false,
      errorCode: ERR_BROKER_SYMBOL_MAPPING_STALE,
      message:
        "Broker symbol mapping is stale. Refresh execution eligibility before retrying.",
      displaySymbol: input.requestedDisplaySymbol ?? canonicalize(chosen.canonical_symbol),
      brokerSymbol: chosen.broker_symbol,
      canonicalSymbol: canonicalize(chosen.canonical_symbol || chosen.broker_symbol),
      accountTradeMode: null,
      symbolTradeMode: chosen.trade_mode ?? null,
      accountTradeEligible: false,
      symbolTradeEligible: !!chosen.trade_eligible,
      symbolMappingSource: chosen.source ?? "trading_layer_symbols",
      symbolMappingCheckedAt: chosen.last_synced_at ?? null,
      catalogRowId: chosen.id ?? null,
    };
  }

  if (!chosen.trade_eligible) {
    return {
      ok: false,
      errorCode: ERR_SYMBOL_TRADE_MODE_BLOCKED,
      message: `Trading Layer reports symbol ${chosen.broker_symbol} is not tradable (trade_mode=${chosen.trade_mode ?? "unknown"}).`,
      displaySymbol: input.requestedDisplaySymbol ?? canonicalize(chosen.canonical_symbol),
      brokerSymbol: chosen.broker_symbol,
      canonicalSymbol: canonicalize(chosen.canonical_symbol || chosen.broker_symbol),
      accountTradeMode: null,
      symbolTradeMode: chosen.trade_mode ?? null,
      accountTradeEligible: false,
      symbolTradeEligible: false,
      symbolMappingSource: chosen.source ?? "trading_layer_symbols",
      symbolMappingCheckedAt: chosen.last_synced_at ?? null,
      catalogRowId: chosen.id ?? null,
    };
  }

  return {
    ok: true,
    displaySymbol: input.requestedDisplaySymbol ?? canonicalize(chosen.canonical_symbol),
    brokerSymbol: chosen.broker_symbol,
    canonicalSymbol: canonicalize(chosen.canonical_symbol || chosen.broker_symbol),
    accountTradeMode: null, // account-level mode is gated by submit-best-execution-order; cache-only path leaves null
    symbolTradeMode: chosen.trade_mode ?? null,
    accountTradeEligible: true,
    symbolTradeEligible: true,
    symbolMappingSource: chosen.source ?? "trading_layer_symbols",
    symbolMappingCheckedAt: chosen.last_synced_at ?? null,
    catalogRowId: chosen.id ?? null,
  };
}

export function brokerSymbolGateResponse(
  version: string,
  result: ResolveResult,
  extra: Record<string, unknown> = {},
) {
  return {
    success: false,
    version,
    step: "broker_symbol_gate",
    classification: (result.errorCode ?? ERR_BROKER_SYMBOL_UNRESOLVED).toLowerCase(),
    liveOrderAttempted: false,
    liveOrderSent: false,
    brokerAccepted: false,
    error: result.errorCode,
    message: result.message,
    displaySymbol: result.displaySymbol,
    brokerSymbol: result.brokerSymbol,
    symbolTradeMode: result.symbolTradeMode,
    symbolMappingSource: result.symbolMappingSource,
    symbolMappingCheckedAt: result.symbolMappingCheckedAt,
    ...extra,
  };
}
