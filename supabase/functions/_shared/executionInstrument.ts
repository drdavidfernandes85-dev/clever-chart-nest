// Shared, single-source-of-truth pre-trade execution-instrument resolver.
//
// Used by BOTH the terminal eligibility endpoint and the live submission
// path so the Order Ticket and submit-best-execution-order can never
// disagree about whether EURUSD SELL (or any other instrument+operation)
// is executable. Replaces the divergent legacy get-trading-execution-eligibility
// interpretation that treated numeric account.trade_mode as "awaiting enum
// confirmation" instead of using the OpenAPI ENUM_SYMBOL_TRADE_MODE.

import { resolveActiveMtMapping } from "./mtMapping.ts";
import {
  resolveEligibleBrokerSymbol,
  refreshTradeModeFromTradingLayer,
  ERR_BROKER_SYMBOL_AMBIGUOUS,
  ERR_BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED,
  ERR_SYMBOL_TRADE_MODE_BLOCKED,
  ERR_BROKER_SYMBOL_MAPPING_STALE,
} from "./brokerSymbol.ts";
import {
  EXECUTION_POLICY_VERSION,
  ExecutionOperation,
  checkAccountOperationEligibility,
  checkOperationEligibility,
  interpretTradeMode,
} from "./tradingLayerTradeMode.ts";

export const VERIFIED_EXECUTION_INSTRUMENT_VERSION =
  "RESOLVE_VERIFIED_EXECUTION_INSTRUMENT_V1_2026_05_26";

export type InstrumentResolutionStatus =
  | "resolved_unique_verified"
  | "resolved_unique_verified_ack_required"
  | "ambiguous_multiple_executable_variants"
  | "unresolved"
  | "no_mt5_mapping"
  | "stale_mapping";

export interface VerifiedExecutionInstrument {
  success: boolean;
  errorCode: string | null;
  message: string | null;
  displaySymbol: string;
  canonicalSymbol: string;
  brokerSymbol: string | null;
  resolutionStatus: InstrumentResolutionStatus;
  expectedBrokerSymbolMatched: boolean | null;
  routeAccountId: string | null;
  routeAccountIdMasked: string | null;
  routeVerified: boolean;
  tradeAllowed: boolean | null;
  accountTradeModeRaw: number | null;
  accountTradeModeLabel: string | null;
  symbolTradeModeRaw: number | null;
  symbolTradeModeLabel: string | null;
  volumeMin: number | null;
  volumeStep: number | null;
  buyReady: boolean;
  buyBlockedReason: string | null;
  sellReady: boolean;
  sellBlockedReason: string | null;
  operation: ExecutionOperation | null;
  operationEligible: boolean;
  operationBlockedReason: string | null;
  discrepancyAcknowledged: boolean;
  executionPolicyVersion: string;
  resolverVersion: string;
  checkedAt: string;
}

function canonicalize(sym: string | null | undefined): string {
  return String(sym ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function mask(id: string | null | undefined): string | null {
  if (!id) return null;
  const s = String(id);
  if (s.length <= 8) return s;
  return `${s.slice(0, 3)}…${s.slice(-4)}`;
}

export interface ResolveVerifiedInput {
  userId: string;
  displaySymbol: string;
  operation?: ExecutionOperation | null;
  expectedBrokerSymbol?: string | null;
}

export async function resolveVerifiedExecutionInstrument(
  supabaseService: any,
  input: ResolveVerifiedInput,
): Promise<VerifiedExecutionInstrument> {
  const checkedAt = new Date().toISOString();
  const canonical = canonicalize(input.displaySymbol);
  const base: VerifiedExecutionInstrument = {
    success: false,
    errorCode: null,
    message: null,
    displaySymbol: canonical,
    canonicalSymbol: canonical,
    brokerSymbol: null,
    resolutionStatus: "unresolved",
    expectedBrokerSymbolMatched: null,
    routeAccountId: null,
    routeAccountIdMasked: null,
    routeVerified: false,
    tradeAllowed: null,
    accountTradeModeRaw: null,
    accountTradeModeLabel: null,
    symbolTradeModeRaw: null,
    symbolTradeModeLabel: null,
    volumeMin: null,
    volumeStep: null,
    buyReady: false,
    buyBlockedReason: null,
    sellReady: false,
    sellBlockedReason: null,
    operation: input.operation ?? null,
    operationEligible: false,
    operationBlockedReason: null,
    discrepancyAcknowledged: false,
    executionPolicyVersion: EXECUTION_POLICY_VERSION,
    resolverVersion: VERIFIED_EXECUTION_INSTRUMENT_VERSION,
    checkedAt,
  };

  if (!canonical) {
    return { ...base, errorCode: "SYMBOL_REQUIRED", message: "displaySymbol is required." };
  }

  const mapping = await resolveActiveMtMapping(supabaseService, input.userId);
  if (mapping.status === "missing" || !mapping.traderId) {
    return {
      ...base,
      errorCode: "NO_CONNECTED_MT5_ACCOUNT",
      message: "No connected MT5 account.",
      resolutionStatus: "no_mt5_mapping",
    };
  }
  if (mapping.status === "stale") {
    return {
      ...base,
      errorCode: "MT5_MAPPING_STALE",
      message: "MT5 mapping is stale. Reconnect the account before trading.",
      resolutionStatus: "stale_mapping",
    };
  }

  const accountId = mapping.tradingLayerAccountId ?? null;
  base.routeAccountId = accountId;
  base.routeAccountIdMasked = mask(accountId);
  base.routeVerified = !!accountId;

  const resolveOnce = () => resolveEligibleBrokerSymbol(supabaseService, {
    userId: input.userId,
    traderId: mapping.traderId!,
    accountId,
    requestedDisplaySymbol: canonical,
    operationType: "market_order",
  });

  let resolved = await resolveOnce();

  // Server-side stale-cache self-heal: if the catalogue is stale or empty for
  // this account, trigger a targeted sync for the requested symbol and retry
  // resolution ONCE before rejecting. Rejection is the last resort, not the
  // first response to a stale cache.
  if (!resolved.ok && resolved.errorCode === ERR_BROKER_SYMBOL_MAPPING_STALE) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/functions/v1/sync-broker-symbol-catalog`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "x-internal-stale-refresh": "1",
          },
          body: JSON.stringify({
            symbols: [canonical],
            mode: "targeted_symbol_refresh",
            targetUserId: input.userId,
          }),
        }).catch(() => null);
      }
    } catch { /* best-effort; fall through to retry */ }
    resolved = await resolveOnce();
  }

  if (!resolved.ok && resolved.errorCode === ERR_BROKER_SYMBOL_AMBIGUOUS) {
    return {
      ...base,
      errorCode: ERR_BROKER_SYMBOL_AMBIGUOUS,
      message: resolved.message ?? "Multiple executable broker variants — broker symbol cannot be auto-picked.",
      resolutionStatus: "ambiguous_multiple_executable_variants",
      buyBlockedReason: ERR_BROKER_SYMBOL_AMBIGUOUS,
      sellBlockedReason: ERR_BROKER_SYMBOL_AMBIGUOUS,
      operationBlockedReason: ERR_BROKER_SYMBOL_AMBIGUOUS,
    };
  }

  const ackRequired = !resolved.ok && resolved.errorCode === ERR_BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED;
  const catalogStaleButResolvable =
    !resolved.ok && !ackRequired && !!resolved.brokerSymbol &&
    (resolved.errorCode === ERR_SYMBOL_TRADE_MODE_BLOCKED ||
     resolved.errorCode === ERR_BROKER_SYMBOL_MAPPING_STALE);

  if (!resolved.ok && !ackRequired && !catalogStaleButResolvable) {
    return {
      ...base,
      errorCode: resolved.errorCode ?? "BROKER_SYMBOL_UNRESOLVED",
      message: resolved.message ?? "Broker symbol could not be resolved for this account.",
      resolutionStatus: "unresolved",
      buyBlockedReason: resolved.errorCode ?? "BROKER_SYMBOL_UNRESOLVED",
      sellBlockedReason: resolved.errorCode ?? "BROKER_SYMBOL_UNRESOLVED",
      operationBlockedReason: resolved.errorCode ?? "BROKER_SYMBOL_UNRESOLVED",
    };
  }

  const brokerSymbol = resolved.brokerSymbol!;
  base.brokerSymbol = brokerSymbol;
  base.resolutionStatus = ackRequired
    ? "resolved_unique_verified_ack_required"
    : "resolved_unique_verified";
  base.discrepancyAcknowledged = !ackRequired;

  // Expected broker symbol mismatch guard (ticket may have been stale on client).
  if (input.expectedBrokerSymbol) {
    const matched = String(input.expectedBrokerSymbol).trim() === brokerSymbol;
    base.expectedBrokerSymbolMatched = matched;
    if (!matched) {
      return {
        ...base,
        errorCode: "BROKER_SYMBOL_CHANGED_REVALIDATE_TICKET",
        message: `Broker symbol changed since the ticket was opened (client expected ${input.expectedBrokerSymbol}, backend resolves ${brokerSymbol}). Revalidate the ticket.`,
        buyBlockedReason: "BROKER_SYMBOL_CHANGED_REVALIDATE_TICKET",
        sellBlockedReason: "BROKER_SYMBOL_CHANGED_REVALIDATE_TICKET",
        operationBlockedReason: "BROKER_SYMBOL_CHANGED_REVALIDATE_TICKET",
      };
    }
  } else {
    base.expectedBrokerSymbolMatched = null;
  }

  // Fresh per-symbol + account trade-mode snapshot.
  const fresh = await refreshTradeModeFromTradingLayer(supabaseService, {
    traderId: mapping.traderId!,
    accountId,
    brokerSymbol,
    login: mapping.login,
    server: mapping.server,
    operation: null,
  });
  base.tradeAllowed = fresh.accountTradeAllowed ?? null;
  base.accountTradeModeRaw = fresh.accountTradeModeRaw ?? null;
  base.accountTradeModeLabel = fresh.accountTradeModeLabel ?? null;
  base.symbolTradeModeRaw = fresh.symbolTradeModeRaw ?? null;
  const symInfo = interpretTradeMode(fresh.symbolTradeModeRaw);
  base.symbolTradeModeLabel = fresh.symbolTradeModeLabel ?? symInfo.label;

  // Volume from catalogue row (best-effort).
  try {
    const { data: row } = await supabaseService
      .from("broker_symbol_catalog")
      .select("volume_min, volume_step")
      .eq("trading_layer_account_id", accountId)
      .eq("broker_symbol", brokerSymbol)
      .maybeSingle();
    base.volumeMin = (row as any)?.volume_min != null ? Number((row as any).volume_min) : null;
    base.volumeStep = (row as any)?.volume_step != null ? Number((row as any).volume_step) : null;
  } catch { /* best-effort */ }

  const sideEligibility = (side: "buy" | "sell"): { ready: boolean; reason: string | null } => {
    if (fresh.errorCode && !fresh.ok) return { ready: false, reason: fresh.errorCode };
    if (ackRequired) return { ready: false, reason: "BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED" };
    const op = side === "buy" ? "market_buy" : "market_sell" as const;
    const acc = checkAccountOperationEligibility(op, base.tradeAllowed, base.accountTradeModeRaw);
    if (!acc.allowed) return { ready: false, reason: acc.reason };
    const sym = checkOperationEligibility(op, base.symbolTradeModeRaw);
    if (!sym.allowed) return { ready: false, reason: sym.reason };
    return { ready: true, reason: null };
  };
  const buy = sideEligibility("buy");
  const sell = sideEligibility("sell");
  base.buyReady = buy.ready;
  base.buyBlockedReason = buy.reason;
  base.sellReady = sell.ready;
  base.sellBlockedReason = sell.reason;

  if (input.operation) {
    const side = input.operation === "market_buy" || input.operation === "pending_buy_limit" ||
                 input.operation === "pending_buy_stop" ? "buy" : "sell";
    const op = sideEligibility(side as "buy" | "sell");
    base.operationEligible = op.ready;
    base.operationBlockedReason = op.reason;
  } else {
    base.operationEligible = buy.ready || sell.ready;
  }

  base.success = true;
  return base;
}
