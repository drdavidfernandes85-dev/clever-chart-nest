// Terminal-facing execution eligibility resolver.
//
// Backend single source of truth that the Order Ticket consumes to decide
// whether BUY @ MKT and SELL @ MKT are enabled for the selected symbol.
// Mirrors the verified flow used by submit-best-execution-order so the UI
// never disagrees with what the mutation path will accept.
//
// Read-only. Does NOT place orders. Does NOT mutate symbol catalogue
// beyond the best-effort upsert done inside refreshTradeModeFromTradingLayer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import {
  resolveEligibleBrokerSymbol,
  refreshTradeModeFromTradingLayer,
  ERR_BROKER_SYMBOL_AMBIGUOUS,
  ERR_BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED,
  ERR_SYMBOL_TRADE_MODE_BLOCKED,
  ERR_BROKER_SYMBOL_MAPPING_STALE,
} from "../_shared/brokerSymbol.ts";
import {
  EXECUTION_POLICY_VERSION,
  checkAccountOperationEligibility,
  checkOperationEligibility,
  interpretTradeMode,
} from "../_shared/tradingLayerTradeMode.ts";

const VERSION = "TERMINAL_EXEC_ELIGIBILITY_V1_2026_05_26";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function canonicalize(sym: string | null | undefined): string {
  return String(sym ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function maskAccountId(id: string | null | undefined): string | null {
  if (!id) return null;
  const s = String(id);
  if (s.length <= 8) return s;
  return `${s.slice(0, 3)}…${s.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    auth.replace("Bearer ", ""),
  );
  if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* allow */ }
  const displaySymbolIn = String(body?.symbol ?? body?.displaySymbol ?? "").trim();
  const canonicalSymbol = canonicalize(displaySymbolIn);
  if (!canonicalSymbol) {
    return json({
      success: false,
      version: VERSION,
      executionPolicyVersion: EXECUTION_POLICY_VERSION,
      error: "SYMBOL_REQUIRED",
      message: "displaySymbol is required.",
    });
  }

  const checkedAt = new Date().toISOString();

  // 1) MT5 mapping + verified execution route.
  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status === "missing" || !mapping.traderId) {
    return json({
      success: false,
      version: VERSION,
      executionPolicyVersion: EXECUTION_POLICY_VERSION,
      displaySymbol: canonicalSymbol,
      canonicalSymbol,
      brokerSymbol: null,
      brokerSymbolResolution: "no_mt5_mapping",
      routeVerified: false,
      buyReady: false, sellReady: false,
      blockedReason: "NO_CONNECTED_MT5_ACCOUNT",
      checkedAt,
    });
  }
  if (mapping.status === "stale") {
    return json({
      success: false,
      version: VERSION,
      executionPolicyVersion: EXECUTION_POLICY_VERSION,
      displaySymbol: canonicalSymbol,
      canonicalSymbol,
      brokerSymbol: null,
      brokerSymbolResolution: "stale_mapping",
      routeVerified: false,
      buyReady: false, sellReady: false,
      blockedReason: "MT5_MAPPING_STALE",
      checkedAt,
    });
  }

  const traderId = mapping.traderId!;
  const accountId = mapping.tradingLayerAccountId ?? null;
  const routeMasked = maskAccountId(accountId);

  // 2) Resolve verified exact broker symbol from per-account catalogue.
  const resolved = await resolveEligibleBrokerSymbol(supabase, {
    userId: user.id,
    traderId,
    accountId,
    requestedDisplaySymbol: canonicalSymbol,
    operationType: "market_order",
  });

  // Ambiguous → both sides blocked.
  if (!resolved.ok && resolved.errorCode === ERR_BROKER_SYMBOL_AMBIGUOUS) {
    return json({
      success: true,
      version: VERSION,
      executionPolicyVersion: EXECUTION_POLICY_VERSION,
      displaySymbol: canonicalSymbol,
      canonicalSymbol,
      brokerSymbol: null,
      brokerSymbolResolution: "ambiguous_multiple_executable_variants",
      ambiguousVariants: resolved.ambiguousVariants ?? null,
      routeVerified: !!accountId,
      routeAccountIdMasked: routeMasked,
      buyReady: false, sellReady: false,
      blockedReason: "BROKER_SYMBOL_AMBIGUOUS_MULTIPLE_EXECUTABLE_VARIANTS",
      buyBlockedReason: "BROKER_SYMBOL_AMBIGUOUS_MULTIPLE_EXECUTABLE_VARIANTS",
      sellBlockedReason: "BROKER_SYMBOL_AMBIGUOUS_MULTIPLE_EXECUTABLE_VARIANTS",
      checkedAt,
    });
  }

  // Discrepancy ack required — still return modes for transparency,
  // surface a clear ack reason and block both sides until acknowledged.
  const ackRequired = !resolved.ok && resolved.errorCode === ERR_BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED;

  if (!resolved.ok && !ackRequired) {
    return json({
      success: false,
      version: VERSION,
      executionPolicyVersion: EXECUTION_POLICY_VERSION,
      displaySymbol: canonicalSymbol,
      canonicalSymbol,
      brokerSymbol: resolved.brokerSymbol ?? null,
      brokerSymbolResolution: "unresolved",
      routeVerified: !!accountId,
      routeAccountIdMasked: routeMasked,
      buyReady: false, sellReady: false,
      blockedReason: resolved.errorCode || "BROKER_SYMBOL_UNRESOLVED",
      message: resolved.message ?? null,
      checkedAt,
    });
  }

  const brokerSymbol = resolved.brokerSymbol!;

  // 3) Fresh trade_mode snapshot (account + symbol) without committing to a
  // specific operation — we compute per-side eligibility ourselves below.
  const fresh = await refreshTradeModeFromTradingLayer(supabase, {
    traderId,
    accountId,
    brokerSymbol,
    login: mapping.login,
    server: mapping.server,
    operation: null,
  });

  const accountTradeAllowed = fresh.accountTradeAllowed ?? null;
  const accountTradeModeRaw = fresh.accountTradeModeRaw ?? null;
  const accountTradeModeLabel = fresh.accountTradeModeLabel ?? null;
  const symbolTradeModeRaw = fresh.symbolTradeModeRaw ?? null;
  const symbolTradeModeLabel = fresh.symbolTradeModeLabel ?? null;
  const symbolInfo = interpretTradeMode(symbolTradeModeRaw);

  // Pull volume_min / volume_step from latest catalogue row.
  let volumeMin: number | null = null;
  let volumeStep: number | null = null;
  try {
    const { data: row } = await supabase
      .from("broker_symbol_catalog")
      .select("volume_min, volume_step")
      .eq("trading_layer_account_id", accountId)
      .eq("broker_symbol", brokerSymbol)
      .maybeSingle();
    volumeMin = (row as any)?.volume_min != null ? Number((row as any).volume_min) : null;
    volumeStep = (row as any)?.volume_step != null ? Number((row as any).volume_step) : null;
  } catch { /* best-effort */ }

  // 4) Per-side combined eligibility (account + symbol + ack).
  function sideEligibility(side: "buy" | "sell"): { ready: boolean; reason: string | null } {
    if (fresh.errorCode && !fresh.ok) {
      return { ready: false, reason: fresh.errorCode };
    }
    if (ackRequired) {
      return { ready: false, reason: "BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED" };
    }
    const op = side === "buy" ? "market_buy" : "market_sell" as const;
    const acc = checkAccountOperationEligibility(op, accountTradeAllowed, accountTradeModeRaw);
    if (!acc.allowed) return { ready: false, reason: acc.reason };
    const sym = checkOperationEligibility(op, symbolTradeModeRaw);
    if (!sym.allowed) return { ready: false, reason: sym.reason };
    return { ready: true, reason: null };
  }
  const buy = sideEligibility("buy");
  const sell = sideEligibility("sell");

  return json({
    success: true,
    version: VERSION,
    executionPolicyVersion: EXECUTION_POLICY_VERSION,
    displaySymbol: canonicalSymbol,
    canonicalSymbol,
    brokerSymbol,
    brokerSymbolResolution: ackRequired
      ? "resolved_unique_verified_ack_required"
      : "resolved_unique_verified",
    routeVerified: !!accountId,
    routeAccountIdMasked: routeMasked,
    tradeAllowed: accountTradeAllowed,
    accountTradeModeRaw,
    accountTradeModeLabel,
    symbolTradeModeRaw,
    symbolTradeModeLabel: symbolTradeModeLabel ?? symbolInfo.label,
    volumeMin, volumeStep,
    discrepancyAcknowledged: !ackRequired,
    buyReady: buy.ready,
    buyBlockedReason: buy.reason,
    sellReady: sell.ready,
    sellBlockedReason: sell.reason,
    blockedReason: !buy.ready && !sell.ready ? (buy.reason || sell.reason) : null,
    checkedAt,
  });
});
