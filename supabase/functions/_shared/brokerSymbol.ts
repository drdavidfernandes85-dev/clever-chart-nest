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

export const TTL_SECONDS_DEFAULT = 60 * 60; // 1 hour

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
