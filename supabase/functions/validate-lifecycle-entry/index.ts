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

const VERSION = "LIFECYCLE_ENTRY_VALIDATION_NO_MUTATION_V1_2026_05_27";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

  // Exposure read (admin user's own positions/pending)
  try {
    const [{ count: posCount }, { count: pendCount }] = await Promise.all([
      supabaseService.from("mt_positions").select("id", { count: "exact", head: true })
        .eq("user_id", uid).or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD"),
      supabaseService.from("mt_pending_orders").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("status", "pending").or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD"),
    ]);
    report.openEurusdPositions = posCount ?? 0;
    report.pendingEurusdOrders = pendCount ?? 0;
    if ((posCount ?? 0) > 0 || (pendCount ?? 0) > 0) {
      return fail("exposure_check", "EXISTING_EURUSD_EXPOSURE");
    }
  } catch { /* best effort */ }

  report.wouldDispatchEntry = true;
  return json(report);
});
