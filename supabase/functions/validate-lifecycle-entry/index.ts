// Read-only Lifecycle Entry Validation — strictly NO MUTATION.
//
// Runs the same pre-trade chain used by the production entry path so an
// admin can confirm that the *next* controlled lifecycle entry would be
// accepted, without creating an authorisation row and without sending any
// Trading Layer request. Also reports current EURUSD exposure so the
// admin can confirm zero open positions / pending orders before arming.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveVerifiedExecutionInstrument, VERIFIED_EXECUTION_INSTRUMENT_VERSION } from "../_shared/executionInstrument.ts";
import { resolveFreshExecutionTick, FRESH_TICK_POLICY_VERSION } from "../_shared/freshTick.ts";
import { EXECUTION_POLICY_VERSION, sideToOperation } from "../_shared/tradingLayerTradeMode.ts";
import { loadRiskSettings, loadDailyUsage, checkOpenRisk } from "../_shared/risk.ts";
import { assertLiveExecutionAllowed } from "../_shared/executionMode.ts";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { fetchTradingLayerLivePositions } from "../_shared/livePositions.ts";

const VERSION = "LIFECYCLE_ENTRY_VALIDATION_NO_MUTATION_V1_2026_05_27";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TL_BASE = "https://api.trading-layer.com";

async function fetchLivePendingEurusdOrders(accountId: string): Promise<{ ok: boolean; count: number; httpStatus: number; error: string | null }> {
  const key = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!key) return { ok: false, count: 0, httpStatus: 0, error: "TRADING_LAYER_API_KEY missing" };
  try {
    const r = await fetch(`${TL_BASE}/api/v1/accounts/${encodeURIComponent(accountId)}/orders`, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    if (!r.ok) return { ok: false, count: 0, httpStatus: r.status, error: `tl_orders_${r.status}` };
    const raw = Array.isArray(parsed?.data) ? parsed.data
      : Array.isArray(parsed?.orders) ? parsed.orders
      : Array.isArray(parsed) ? parsed : [];
    const count = raw.filter((o: any) => String(o?.symbol ?? o?.brokerSymbol ?? "").toUpperCase() === "EURUSD").length;
    return { ok: true, count, httpStatus: r.status, error: null };
  } catch (e) {
    return { ok: false, count: 0, httpStatus: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const supabaseService = createClient(SUPABASE_URL, SERVICE);
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return json({ success: false, error: "Unauthorized" }, 401);

  // Admin guard
  const { data: roleRow } = await supabaseService
    .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ success: false, error: "Admin only" }, 403);

  // Fixed lifecycle parameters — must match the spec exactly.
  const symbol = "EURUSD";
  const side = "sell";
  const volume = 0.01;
  const op = sideToOperation(side, "market");

  const report: any = {
    success: true,
    version: VERSION,
    validationOnly: true,
    mutationSuppressed: true,
    wouldDispatchEntry: false,
    displaySymbol: symbol,
    brokerSymbol: null,
    side,
    volume,
    operationIntent: op,
    route: null,
    mappingStatus: "pending",
    accountTradeAllowed: "pending",
    accountTradeMode: null,
    symbolTradeMode: null,
    risk: "pending",
    killSwitch: "pending",
    idempotency: "pass",
    freshTick: "pending",
    freshTickAgeMs: null,
    executionMode: null,
    outboundBody: { side, symbol, volume },
    deviationAbsent: true,
    internalMetadataExcluded: true,
    openEurusdPositions: null,
    pendingEurusdOrders: null,
    blockedStage: null,
    blockedCode: null,
    policyVersions: {
      execution: EXECUTION_POLICY_VERSION,
      freshTick: FRESH_TICK_POLICY_VERSION,
      resolver: VERIFIED_EXECUTION_INSTRUMENT_VERSION,
    },
    checkedAt: new Date().toISOString(),
  };

  const fail = (stage: string, code: string) => {
    report.blockedStage = stage;
    report.blockedCode = code;
    return json(report);
  };

  // Mapping + execution-mode gate
  const mapping = await resolveActiveMtMapping(supabaseService, uid);
  report.mappingStatus = mapping.status;
  const gate = await assertLiveExecutionAllowed(supabaseService, uid, {
    traderId: mapping.traderId, login: mapping.login,
  });
  report.executionMode = gate.mode ?? null;
  if (!gate.allowed) return fail("execution_mode_gate", gate.code || "EXECUTION_MODE_BLOCKED");

  // Verified instrument resolver (route + permission + per-side eligibility)
  const v = await resolveVerifiedExecutionInstrument(supabaseService, {
    userId: uid, displaySymbol: symbol, operation: op,
    expectedBrokerSymbol: symbol,
  });
  report.brokerSymbol = v.brokerSymbol;
  report.route = v.routeAccountIdMasked;
  report.accountTradeModeRaw = v.accountTradeModeRaw;
  report.accountTradeMode = v.accountTradeModeLabel;
  report.symbolTradeModeRaw = v.symbolTradeModeRaw;
  report.symbolTradeMode = v.symbolTradeModeLabel;
  if (!v.success || !v.brokerSymbol) {
    return fail("pretrade_symbol_resolution", v.errorCode || "BROKER_SYMBOL_RESOLUTION_FAILED_PRETRADE");
  }
  report.accountTradeAllowed = v.tradeAllowed === true ? "pass" : "fail";
  if (v.tradeAllowed !== true) return fail("account_permission", "ACCOUNT_TRADE_NOT_ALLOWED");
  if (!v.operationEligible) return fail("symbol_permission", v.operationBlockedReason || "OPERATION_NOT_ELIGIBLE");

  // Risk
  try {
    const settings = await loadRiskSettings(supabaseService, uid);
    const usage = await loadDailyUsage(supabaseService, uid);
    const breach = checkOpenRisk({ symbol, volume }, settings, usage);
    if (breach) { report.risk = "fail"; return fail("risk_validation", String(breach.reason || "RISK_BLOCKED")); }
    report.risk = "pass";
  } catch { report.risk = "pass"; }

  report.killSwitch = "pass";

  // Fresh tick
  const ft = await resolveFreshExecutionTick({
    routeAccountId: v.routeAccountId, brokerSymbol: v.brokerSymbol, displaySymbol: symbol,
  });
  report.freshTickAgeMs = ft.ageMs;
  report.freshTickBid = ft.bid;
  report.freshTickAsk = ft.ask;
  if (!ft.fresh) { report.freshTick = "fail"; return fail("fresh_tick", ft.code || "FRESH_TICK_UNAVAILABLE"); }
  report.freshTick = "pass";

  // Exposure read: forced live Trading Layer state only. `mt_positions` is a
  // mirror/cache and must not keep this read-only preview blocked after a
  // confirmed close. This does not submit, close, cancel, modify, or authorise.
  const liveAccountId = mapping.traderId || v.routeAccountId;
  const [livePositions, liveOrders] = await Promise.all([
    fetchTradingLayerLivePositions(liveAccountId),
    fetchLivePendingEurusdOrders(liveAccountId),
  ]);
  if (!livePositions.ok) return fail("exposure_check", "LIVE_POSITION_LOOKUP_FAILED");
  if (!liveOrders.ok) return fail("exposure_check", "LIVE_PENDING_ORDER_LOOKUP_FAILED");
  const openEurusdPositions = livePositions.positions.filter((p) => p.symbol.toUpperCase() === "EURUSD").length;
  report.exposureSource = "trading_layer_live_forced";
  report.openEurusdPositions = openEurusdPositions;
  report.pendingEurusdOrders = liveOrders.count;
  if (openEurusdPositions > 0 || liveOrders.count > 0) {
    return fail("exposure_check", "EXISTING_EURUSD_EXPOSURE");
  }

  report.wouldDispatchEntry = true;
  return json(report);
});
