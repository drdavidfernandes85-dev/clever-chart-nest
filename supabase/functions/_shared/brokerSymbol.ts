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

import {
  checkOperationEligibility,
  ERR_ACCOUNT_TRADE_NOT_ALLOWED,
  ERR_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE,
  ERR_SYMBOL_DIRECTION_BLOCKED,
  ExecutionOperation,
  interpretTradeMode as interpretTradeModeEnum,
  TRADE_MODE_DISABLED,
} from "./tradingLayerTradeMode.ts";

export interface FreshTradeModeResult {
  ok: boolean;
  errorCode?: string;
  message?: string;
  accountTradeMode: string | null;        // raw value, kept as string for back-compat
  accountTradeEligible: boolean;
  accountTradeAllowed: boolean | null;    // trade_allowed boolean from /accounts/{id}
  accountTradeModeRaw: number | null;
  accountTradeModeLabel: string | null;
  symbolTradeMode: string | null;
  symbolTradeEligible: boolean;
  symbolTradeModeRaw: number | null;
  symbolTradeModeLabel: string | null;
  brokerSymbol: string | null;
  operation: ExecutionOperation | null;
  directionAllowed: boolean | null;
  directionReason: string | null;
  accountTradeModeCheckedAt: string | null;
  symbolTradeModeCheckedAt: string | null;
}

/**
 * Refresh account-level permission + per-symbol trade_mode directly from
 * Trading Layer. Uses the OpenAPI account info endpoint (`/accounts/{id}`)
 * and the symbol detail endpoint (`/accounts/{id}/symbols/{name}`).
 *
 * Account-level gate uses `trade_allowed`. Per-symbol gate uses the enum
 * mapping from `tradingLayerTradeMode.ts`. When an explicit operation is
 * supplied, directional eligibility (BUY/SELL/close/modify) is enforced.
 */
export async function refreshTradeModeFromTradingLayer(
  supabaseService: any,
  args: {
    traderId: string;
    accountId?: string | null; // REQUIRED — used for both account & symbol calls
    brokerSymbol: string;
    login?: string | null;
    server?: string | null;
    operation?: ExecutionOperation | null;
  },
): Promise<FreshTradeModeResult> {
  const TL_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
  const empty: FreshTradeModeResult = {
    ok: false,
    accountTradeMode: null, accountTradeEligible: false,
    accountTradeAllowed: null, accountTradeModeRaw: null, accountTradeModeLabel: null,
    symbolTradeMode: null, symbolTradeEligible: false,
    symbolTradeModeRaw: null, symbolTradeModeLabel: null,
    brokerSymbol: args.brokerSymbol,
    operation: args.operation ?? null,
    directionAllowed: null, directionReason: null,
    accountTradeModeCheckedAt: null, symbolTradeModeCheckedAt: null,
  };
  if (!TL_KEY) return { ...empty, errorCode: "TL_API_KEY_MISSING", message: "Trading Layer key not configured." };
  if (!args.brokerSymbol) return { ...empty, errorCode: ERR_BROKER_SYMBOL_UNRESOLVED, message: "Missing broker symbol." };
  if (!args.accountId) {
    return {
      ...empty,
      errorCode: ERR_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE,
      message: "Trading Layer account id is required for execution permission refresh.",
    };
  }

  const headers = { Authorization: `Bearer ${TL_KEY}`, "Content-Type": "application/json" };
  const now = new Date().toISOString();

  // 1) Account info — trade_allowed + trade_mode
  let accountTradeAllowed: boolean | null = null;
  let accountTradeModeRaw: number | null = null;
  try {
    const r = await fetch(`${TL_BASE_URL}/api/v1/accounts/${args.accountId}`, { headers });
    if (!r.ok) {
      return {
        ...empty,
        errorCode: ERR_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE,
        message: `account_fetch_${r.status}`,
        accountTradeModeCheckedAt: now,
      };
    }
    const parsed = await r.json().catch(() => null);
    const d = parsed?.data ?? parsed;
    if (typeof d?.trade_allowed === "boolean") accountTradeAllowed = d.trade_allowed;
    if (typeof d?.trade_mode === "number") accountTradeModeRaw = d.trade_mode;
  } catch (e) {
    return {
      ...empty,
      errorCode: ERR_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE,
      message: (e as Error).message,
      accountTradeModeCheckedAt: now,
    };
  }
  const accountInfo = interpretTradeModeEnum(accountTradeModeRaw);

  if (accountTradeAllowed === null) {
    return {
      ...empty,
      errorCode: ERR_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE,
      message: "Trading Layer did not return account.trade_allowed.",
      accountTradeModeRaw, accountTradeModeLabel: accountInfo.label,
      accountTradeModeCheckedAt: now,
    };
  }
  if (accountTradeAllowed === false) {
    return {
      ...empty,
      errorCode: ERR_ACCOUNT_TRADE_NOT_ALLOWED,
      message: "Account-level trading is not allowed (trade_allowed=false).",
      accountTradeAllowed, accountTradeModeRaw,
      accountTradeMode: accountTradeModeRaw != null ? String(accountTradeModeRaw) : null,
      accountTradeModeLabel: accountInfo.label,
      accountTradeModeCheckedAt: now,
    };
  }

  // 2) Symbol detail — exact endpoint, no list pagination guessing
  let symbolTradeModeRaw: number | null = null;
  try {
    const r = await fetch(
      `${TL_BASE_URL}/api/v1/accounts/${args.accountId}/symbols/${encodeURIComponent(args.brokerSymbol)}`,
      { headers },
    );
    if (r.status === 404) {
      return {
        ...empty,
        errorCode: ERR_BROKER_SYMBOL_UNRESOLVED,
        message: `Broker symbol ${args.brokerSymbol} not found at /accounts/${args.accountId}/symbols.`,
        accountTradeAllowed, accountTradeModeRaw,
        accountTradeMode: accountTradeModeRaw != null ? String(accountTradeModeRaw) : null,
        accountTradeModeLabel: accountInfo.label, accountTradeEligible: true,
        accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
      };
    }
    if (!r.ok) {
      return {
        ...empty,
        errorCode: "SYMBOLS_FETCH_FAILED",
        message: `symbol_fetch_${r.status}`,
        accountTradeAllowed, accountTradeModeRaw,
        accountTradeMode: accountTradeModeRaw != null ? String(accountTradeModeRaw) : null,
        accountTradeModeLabel: accountInfo.label, accountTradeEligible: true,
        accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
      };
    }
    const parsed = await r.json().catch(() => null);
    const d = parsed?.data ?? parsed;
    if (typeof d?.trade_mode === "number") symbolTradeModeRaw = d.trade_mode;

    // Best-effort catalogue upsert for the one resolved symbol so the
    // staleness/age tracking elsewhere stays accurate.
    if (d && d.name) {
      try {
        const broker = String(d.name);
        const canonical = broker.toUpperCase().replace(/[^A-Z0-9]/g, "");
        await supabaseService.from("broker_symbol_catalog").upsert([{
          trading_layer_trader_id: args.traderId,
          trading_layer_account_id: args.accountId,
          source_endpoint_account_id: args.accountId,
          source_verified: true,
          mt5_login: args.login ? String(args.login) : null,
          mt5_server: args.server ?? null,
          display_symbol: canonical,
          canonical_symbol: canonical,
          broker_symbol: broker,
          description: d.description ?? null,
          digits: d.digits ?? null,
          contract_size: d.trade_contract_size ?? null,
          volume_min: d.volume_min ?? null,
          volume_max: d.volume_max ?? null,
          volume_step: d.volume_step ?? null,
          trade_mode: symbolTradeModeRaw != null ? String(symbolTradeModeRaw) : null,
          trade_mode_raw: symbolTradeModeRaw != null ? String(symbolTradeModeRaw) : null,
          trade_mode_interpretation: interpretTradeModeEnum(symbolTradeModeRaw).label,
          trade_eligible: symbolTradeModeRaw != null && symbolTradeModeRaw !== TRADE_MODE_DISABLED,
          source: "trading_layer_symbol_detail",
          last_synced_at: now,
          checked_at: now,
        }], { onConflict: "trading_layer_account_id,broker_symbol" });
      } catch { /* best-effort */ }
    }
  } catch (e) {
    return {
      ...empty,
      errorCode: "SYMBOLS_FETCH_FAILED",
      message: (e as Error).message,
      accountTradeAllowed, accountTradeModeRaw,
      accountTradeMode: accountTradeModeRaw != null ? String(accountTradeModeRaw) : null,
      accountTradeModeLabel: accountInfo.label, accountTradeEligible: true,
      accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
    };
  }

  const symbolInfo = interpretTradeModeEnum(symbolTradeModeRaw);

  // Directional gating using OpenAPI enum, when an operation is supplied.
  let directionAllowed: boolean | null = null;
  let directionReason: string | null = null;
  if (args.operation) {
    const dir = checkOperationEligibility(args.operation, symbolTradeModeRaw);
    directionAllowed = dir.allowed;
    directionReason = dir.reason;
    if (!dir.allowed) {
      return {
        ok: false,
        errorCode: dir.reason === "SYMBOL_TRADE_DISABLED"
          ? ERR_SYMBOL_TRADE_MODE_BLOCKED
          : ERR_SYMBOL_DIRECTION_BLOCKED,
        message: `Trading Layer symbol ${args.brokerSymbol} trade_mode=${symbolTradeModeRaw} (${symbolInfo.label}) does not permit ${args.operation}.`,
        accountTradeAllowed, accountTradeModeRaw,
        accountTradeMode: accountTradeModeRaw != null ? String(accountTradeModeRaw) : null,
        accountTradeModeLabel: accountInfo.label, accountTradeEligible: true,
        symbolTradeModeRaw, symbolTradeModeLabel: symbolInfo.label,
        symbolTradeMode: symbolTradeModeRaw != null ? String(symbolTradeModeRaw) : null,
        symbolTradeEligible: symbolTradeModeRaw !== TRADE_MODE_DISABLED && symbolTradeModeRaw != null,
        brokerSymbol: args.brokerSymbol,
        operation: args.operation,
        directionAllowed, directionReason,
        accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
      };
    }
  } else {
    // No explicit operation — fall back to "is the instrument tradable at all"
    if (symbolTradeModeRaw == null || symbolTradeModeRaw === TRADE_MODE_DISABLED) {
      return {
        ok: false,
        errorCode: ERR_SYMBOL_TRADE_MODE_BLOCKED,
        message: `Trading Layer symbol ${args.brokerSymbol} is not currently tradable (trade_mode=${symbolTradeModeRaw}).`,
        accountTradeAllowed, accountTradeModeRaw,
        accountTradeMode: accountTradeModeRaw != null ? String(accountTradeModeRaw) : null,
        accountTradeModeLabel: accountInfo.label, accountTradeEligible: true,
        symbolTradeModeRaw, symbolTradeModeLabel: symbolInfo.label,
        symbolTradeMode: symbolTradeModeRaw != null ? String(symbolTradeModeRaw) : null,
        symbolTradeEligible: false,
        brokerSymbol: args.brokerSymbol,
        operation: null, directionAllowed: null, directionReason: null,
        accountTradeModeCheckedAt: now, symbolTradeModeCheckedAt: now,
      };
    }
  }

  return {
    ok: true,
    accountTradeAllowed, accountTradeModeRaw,
    accountTradeMode: accountTradeModeRaw != null ? String(accountTradeModeRaw) : null,
    accountTradeModeLabel: accountInfo.label, accountTradeEligible: true,
    symbolTradeModeRaw, symbolTradeModeLabel: symbolInfo.label,
    symbolTradeMode: symbolTradeModeRaw != null ? String(symbolTradeModeRaw) : null,
    symbolTradeEligible: true,
    brokerSymbol: args.brokerSymbol,
    operation: args.operation ?? null,
    directionAllowed, directionReason,
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
    operation: result.operation,
    accountTradeAllowed: result.accountTradeAllowed,
    accountTradeMode: result.accountTradeMode,
    accountTradeModeRaw: result.accountTradeModeRaw,
    accountTradeModeLabel: result.accountTradeModeLabel,
    symbolTradeMode: result.symbolTradeMode,
    symbolTradeModeRaw: result.symbolTradeModeRaw,
    symbolTradeModeLabel: result.symbolTradeModeLabel,
    directionAllowed: result.directionAllowed,
    directionReason: result.directionReason,
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
export const ERR_BROKER_SYMBOL_AMBIGUOUS = "BROKER_SYMBOL_AMBIGUOUS_MULTIPLE_EXECUTABLE_VARIANTS";
export const ERR_BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED = "BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED";
export const ERR_BROKER_SYMBOL_NOT_LIST_DISCOVERED = "BROKER_SYMBOL_NOT_LIST_DISCOVERED";

export interface ResolveInput {
  userId: string;
  traderId: string;
  accountId?: string | null; // trading_layer_account_id — preferred scope
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
  ambiguousVariants?: string[];
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

  if (!input.traderId && !input.accountId) {
    return { ...empty, errorCode: ERR_BROKER_SYMBOL_UNRESOLVED, message: "Missing trader/account id" };
  }

  // Scope catalogue query by account when available (per-user/per-account isolation),
  // otherwise fall back to trader-scoped lookup for legacy rows only.
  let query = supabaseService
    .from("broker_symbol_catalog")
    .select(
      "id, display_symbol, canonical_symbol, broker_symbol, trade_mode, trade_eligible, source, last_synced_at, source_endpoint_account_id, source_verified, trading_layer_account_id, route_identity_verified, execution_usable, source_account_route_id",
    )
    // Hard gate: never resolve from rows whose route identity has not been
    // remotely verified against the connected MT5 login/server.
    .eq("route_identity_verified", true);
  if (input.accountId) {
    query = query.eq("trading_layer_account_id", input.accountId);
  } else {
    query = query.eq("trading_layer_trader_id", input.traderId);
  }
  const { data: rows, error } = await query;


  if (error) {
    return { ...empty, errorCode: ERR_BROKER_SYMBOL_UNRESOLVED, message: "Catalog read failed" };
  }
  const all: any[] = Array.isArray(rows) ? rows : [];
  if (all.length === 0) {
    return {
      ...empty,
      errorCode: ERR_BROKER_SYMBOL_MAPPING_STALE,
      message:
        "Broker symbol catalog is empty for this account. Refresh execution eligibility first.",
    };
  }

  // 1) If caller supplied an exact broker symbol (close/modify/cancel path), prefer that.
  let chosen: any | null = null;
  if (wantBroker) {
    chosen = all.find((r) => String(r.broker_symbol).trim() === wantBroker) ?? null;
    if (!chosen && wantCanonical) {
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

  // 2) Canonical-driven resolution with ambiguity detection.
  if (!chosen && wantCanonical) {
    const exactMatches = all.filter(
      (r) => canonicalize(r.canonical_symbol || r.broker_symbol) === wantCanonical,
    );
    if (exactMatches.length === 1) {
      chosen = exactMatches[0];
    } else if (exactMatches.length > 1) {
      // Multiple broker variants for one canonical symbol — never auto-pick.
      return {
        ...empty,
        errorCode: ERR_BROKER_SYMBOL_AMBIGUOUS,
        message: `Multiple broker execution instruments match ${wantCanonical} for this account. An admin must select the permitted default before live trading.`,
        ambiguousVariants: exactMatches.map((r) => String(r.broker_symbol)),
        symbolMappingSource: "trading_layer_symbols",
        symbolMappingCheckedAt: exactMatches[0]?.last_synced_at ?? null,
      };
    } else {
      // No exact canonical match — DO NOT silently accept startsWith fallback,
      // since a hardcoded suffix assumption is exactly what the user wants to avoid.
      // Surface as unresolved instead.
      return {
        ...empty,
        errorCode: ERR_BROKER_SYMBOL_UNRESOLVED,
        message:
          `No exact catalogue entry for ${wantCanonical} on this account. Refresh execution eligibility or check that the instrument is available on this MT5 account.`,
      };
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

  // Block resolution from non-LIST/SEARCH-discovered rows (e.g. legacy alias
  // probes). Inspected list/search rows are tagged "executable_discovered_*"
  // by sync-broker-symbol-catalog and refreshTradeModeFromTradingLayer.
  const ms = String((chosen as any).mapping_status ?? "");
  if (ms && !ms.startsWith("executable_discovered") && ms !== "verified_route" && ms !== "trading_layer_symbol_detail") {
    return {
      ...empty,
      errorCode: ERR_BROKER_SYMBOL_NOT_LIST_DISCOVERED,
      message:
        `Broker symbol ${chosen.broker_symbol} originates from an alias probe (mapping_status=${ms}) and is not LIST/SEARCH-discovered. Refresh execution eligibility via Lookup before retrying.`,
      brokerSymbol: chosen.broker_symbol,
      canonicalSymbol: canonicalize(chosen.canonical_symbol || chosen.broker_symbol),
      symbolMappingSource: chosen.source ?? "trading_layer_symbols",
      symbolMappingCheckedAt: chosen.last_synced_at ?? null,
      catalogRowId: chosen.id ?? null,
    };
  }

  // EURUSD-specific gate: require admin acknowledgement of the MT5 suffix
  // display discrepancy (Trading Layer returns `EURUSD` as the executable
  // broker symbol while the native MT5 terminal shows suffixed instruments).
  const canonicalNorm = canonicalize(chosen.canonical_symbol || chosen.broker_symbol);
  if (canonicalNorm === "EURUSD") {
    let ackOk = false;
    try {
      const { data: ackRow } = await supabaseService
        .from("site_settings")
        .select("value")
        .eq("key", "broker_symbol_acknowledgements")
        .maybeSingle();
      ackOk = !!(ackRow as any)?.value?.eurusd_mt5_suffix_discrepancy?.acknowledged;
    } catch { /* ackOk stays false */ }
    if (!ackOk) {
      return {
        ok: false,
        errorCode: ERR_BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED,
        message:
          "API execution symbol resolved as EURUSD; admin acknowledgement required due to MT5 suffix-display discrepancy. Record the acknowledgement in Admin → Broker Symbols before retrying.",
        displaySymbol: input.requestedDisplaySymbol ?? canonicalNorm,
        brokerSymbol: chosen.broker_symbol,
        canonicalSymbol: canonicalNorm,
        accountTradeMode: null,
        symbolTradeMode: chosen.trade_mode ?? null,
        accountTradeEligible: true,
        symbolTradeEligible: true,
        symbolMappingSource: chosen.source ?? "trading_layer_symbols",
        symbolMappingCheckedAt: chosen.last_synced_at ?? null,
        catalogRowId: chosen.id ?? null,
      };
    }
  }

  return {
    ok: true,
    displaySymbol: input.requestedDisplaySymbol ?? canonicalize(chosen.canonical_symbol),
    brokerSymbol: chosen.broker_symbol,
    canonicalSymbol: canonicalize(chosen.canonical_symbol || chosen.broker_symbol),
    accountTradeMode: null,
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
    ambiguousVariants: result.ambiguousVariants ?? null,
    ...extra,
  };
}
