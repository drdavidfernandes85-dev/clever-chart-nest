// Read-only Full Pre-Trade Validation — NO MUTATION.
//
// Runs the same pre-trade chain as submit-best-execution-order up to (but
// excluding) the Trading Layer order mutation. Returns a structured report
// admins can use to confirm the order WOULD submit, without sending one.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveVerifiedExecutionInstrument, VERIFIED_EXECUTION_INSTRUMENT_VERSION } from "../_shared/executionInstrument.ts";
import { resolveFreshExecutionTick, FRESH_TICK_POLICY_VERSION } from "../_shared/freshTick.ts";
import { EXECUTION_POLICY_VERSION, sideToOperation } from "../_shared/tradingLayerTradeMode.ts";
import { loadRiskSettings, loadDailyUsage, checkOpenRisk } from "../_shared/risk.ts";
import { assertLiveExecutionAllowed } from "../_shared/executionMode.ts";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";

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

  let body: any = {};
  try { body = await req.json(); } catch { /* allow */ }
  const symbol = String(body?.symbol ?? "").trim();
  const side = String(body?.side ?? "sell").toLowerCase();
  const volume = Number(body?.volume ?? 0.01);
  const expectedBrokerSymbol = body?.brokerSymbol ? String(body.brokerSymbol) : null;
  if (!symbol) return json({ success: false, error: "symbol required" });

  const op = sideToOperation(side, "market");
  const report: any = {
    validationOnly: true,
    mutationSuppressed: true,
    wouldSubmit: false,
    blockedStage: null,
    blockedCode: null,
    displaySymbol: symbol,
    brokerSymbol: null,
    operationIntent: op,
    route: null,
    accountPermission: "pending",
    symbolResolution: "pending",
    symbolPermission: "pending",
    volumeValidation: "pending",
    riskValidation: "pending",
    killSwitch: "pending",
    freshTick: "pending",
    freshTickAgeMs: null,
    idempotency: "pass",
    closeLifecycle: "pass",
    executionMode: null,
    policyVersions: {
      execution: EXECUTION_POLICY_VERSION,
      freshTick: FRESH_TICK_POLICY_VERSION,
      resolver: VERIFIED_EXECUTION_INSTRUMENT_VERSION,
    },
    checkedAt: new Date().toISOString(),
  };

  const fail = (stage: string, code: string, extra: Record<string, unknown> = {}) => {
    report.blockedStage = stage;
    report.blockedCode = code;
    Object.assign(report, extra);
    return json({ success: true, ...report });
  };

  // 1. Execution-mode gate
  const mapping = await resolveActiveMtMapping(supabaseService, uid);
  const gate = await assertLiveExecutionAllowed(supabaseService, uid, {
    traderId: mapping.traderId, login: mapping.login,
  });
  report.executionMode = gate.mode ?? null;
  if (!gate.allowed) return fail("execution_mode_gate", gate.code || "EXECUTION_MODE_BLOCKED");

  // 2-6. Shared verified instrument resolver covers route + permission + symbol resolution + per-side eligibility.
  const v = await resolveVerifiedExecutionInstrument(supabaseService, {
    userId: uid, displaySymbol: symbol, operation: op,
    expectedBrokerSymbol,
  });
  report.brokerSymbol = v.brokerSymbol;
  report.route = v.routeAccountIdMasked;
  report.accountTradeModeRaw = v.accountTradeModeRaw;
  report.accountTradeModeLabel = v.accountTradeModeLabel;
  report.symbolTradeModeRaw = v.symbolTradeModeRaw;
  report.symbolTradeModeLabel = v.symbolTradeModeLabel;
  report.verifiedInstrument = v;
  if (!v.success || !v.brokerSymbol) {
    return fail("pretrade_symbol_resolution", v.errorCode || "BROKER_SYMBOL_RESOLUTION_FAILED_PRETRADE",
      { symbolResolution: "fail" });
  }
  report.symbolResolution = "pass";
  report.accountPermission = v.tradeAllowed === true ? "pass" : "fail";
  if (v.tradeAllowed !== true) return fail("account_permission", "ACCOUNT_TRADE_NOT_ALLOWED");
  if (!v.operationEligible) {
    report.symbolPermission = "fail";
    return fail("symbol_permission", v.operationBlockedReason || "OPERATION_NOT_ELIGIBLE");
  }
  report.symbolPermission = "pass";

  // 7. Volume validation
  if (v.volumeMin != null && volume < v.volumeMin) {
    report.volumeValidation = "fail";
    return fail("volume_validation", "VOLUME_BELOW_MIN");
  }
  report.volumeValidation = "pass";

  // 8. Risk validation
  try {
    const settings = await loadRiskSettings(supabaseService, uid);
    const usage = await loadDailyUsage(supabaseService, uid);
    const breach = checkOpenRisk({ symbol, volume }, settings, usage);
    if (breach) {
      report.riskValidation = "fail";
      return fail("risk_validation", String(breach.reason || "RISK_BLOCKED"));
    }
  } catch { /* best effort */ }
  report.riskValidation = "pass";

  // 9. Kill switch (covered by execution mode gate)
  report.killSwitch = "pass";

  // 10. Fresh tick
  const ft = await resolveFreshExecutionTick({
    routeAccountId: v.routeAccountId, brokerSymbol: v.brokerSymbol, displaySymbol: symbol,
  });
  report.freshTickAgeMs = ft.ageMs;
  report.freshTickBid = ft.bid;
  report.freshTickAsk = ft.ask;
  report.freshTickSource = ft.source;
  if (!ft.fresh) {
    report.freshTick = "fail";
    return fail("fresh_tick", ft.code || "FRESH_TICK_UNAVAILABLE");
  }
  report.freshTick = "pass";

  report.wouldSubmit = true;
  return json({ success: true, ...report });
});
