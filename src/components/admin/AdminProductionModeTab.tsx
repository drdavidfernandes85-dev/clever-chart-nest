import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getPlatformMode,
  getMarketDataMode,
  isLiveRefreshEnabled,
  getExecutionMode,
  setExecutionMode,
  refreshExecutionMode,
  hasFinalLiveTestPassed,
  isFinalLiveActivationEligible,
  PRODUCTION_MODE_EVENT,
  ADMIN_TESTER_TRADER_ID,
  ADMIN_TESTER_MT5_LOGIN,
  getExecutionPermissionState,
  refreshExecutionPermissionStatus,
  setExecutionPermissionStatus,
  type ExecutionMode,
  type ExecutionPermissionStatus,
} from "@/lib/productionMode";
import { reviewAccessModeEnabled } from "@/lib/accessMode";
import { getCooldownRemainingMs } from "@/lib/tradingLayerControl";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Activity,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import { listAdminLiveTests, verifyFromAudit, type AdminLiveTestRow, type AdminTestType } from "@/lib/adminLiveTests";
import { supabase } from "@/integrations/supabase/client";
import AdminLiveTestLimitsCard from "./AdminLiveTestLimitsCard";
import AdminExecutionEligibilityCard from "./AdminExecutionEligibilityCard";
import AdminControlledRetestCard from "./AdminControlledRetestCard";
import AdminControlledRetestEntryPassCard from "./AdminControlledRetestEntryPassCard";
import AdminFinalLifecycleValidationCard from "./AdminFinalLifecycleValidationCard";
import AdminLivePositionMirrorDiagnostic from "./AdminLivePositionMirrorDiagnostic";
import AdminEurusdFlatnessDiagnostic from "./AdminEurusdFlatnessDiagnostic";

const maskTraderId = (id: string) =>
  id.length <= 12 ? "••••" : `${id.slice(0, 8)}…${id.slice(-4)}`;

const Row = ({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "danger" | "neutral" }) => {
  const colors: Record<string, string> = {
    ok: "text-emerald-400", warn: "text-amber-400", danger: "text-red-400", neutral: "text-foreground",
  };
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 text-sm">
      <span className="text-muted-foreground font-mono text-[11px] uppercase tracking-wider">{label}</span>
      <span className={`font-mono ${colors[tone]}`}>{value}</span>
    </div>
  );
};

interface MatrixDef { id: AdminTestType; label: string; required: boolean }
type Readiness = "ready" | "gated_pending" | "implemented_if_confirmed" | "blocked_cap" | "not_ready";
const SECTIONS: { title: string; readiness: Readiness; note: string; items: MatrixDef[] }[] = [
  {
    title: "Ready to Test Now", readiness: "ready",
    note: "Available now under admin_live_test execution mode.",
    items: [
      { id: "market_buy", label: "Market Buy 0.01", required: true },
      { id: "market_sell", label: "Market Sell 0.01", required: false },
      { id: "full_close", label: "Full close confirmed", required: true },
    ],
  },
  {
    title: "Pending Orders — gated", readiness: "gated_pending",
    note: "Enabled only after Market Open + Close pass and pending_orders_enabled is turned on manually.",
    items: [
      { id: "buy_limit", label: "Buy Limit placement", required: true },
      { id: "sell_limit", label: "Sell Limit placement", required: false },
      { id: "buy_stop", label: "Buy Stop placement", required: false },
      { id: "sell_stop", label: "Sell Stop placement", required: false },
      { id: "cancel_pending", label: "Pending order cancellation", required: true },
    ],
  },
  {
    title: "Implemented if confirmed by inspection", readiness: "implemented_if_confirmed",
    note: "Recorded automatically only after MT5-reported SL/TP refresh matches the requested value.",
    items: [
      { id: "modify_sl", label: "SL modification confirmed", required: true },
      { id: "modify_tp", label: "TP modification confirmed", required: false },
    ],
  },
  {
    title: "Blocked by current 0.01 cap", readiness: "blocked_cap",
    note: "Partial close requires a position larger than the current 0.01 lot admin-test limit.",
    items: [
      { id: "partial_close", label: "Partial close confirmed", required: false },
    ],
  },
  {
    title: "Not Ready", readiness: "not_ready",
    note: "Invert/Reverse requires a sequential close-confirmed-then-open-opposite implementation. Not built.",
    items: [
      { id: "invert_position", label: "Invert / Reverse position", required: false },
    ],
  },
];
const MATRIX: MatrixDef[] = SECTIONS.flatMap((s) => s.items);


const AdminProductionModeTab = () => {
  const [, force] = useState(0);
  const [cooldown, setCooldown] = useState(getCooldownRemainingMs());
  const [rows, setRows] = useState<AdminLiveTestRow[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permState, setPermState] = useState(getExecutionPermissionState());

  const loadRows = async () => {
    setLoading(true);
    try { setRows(await listAdminLiveTests(300)); } finally { setLoading(false); }
  };

  useEffect(() => {
    refreshExecutionMode();
    refreshExecutionPermissionStatus().then(setPermState);
    void loadRows();
    const re = () => {
      force((n) => n + 1);
      setPermState(getExecutionPermissionState());
    };
    window.addEventListener(PRODUCTION_MODE_EVENT, re);
    const id = window.setInterval(() => setCooldown(getCooldownRemainingMs()), 1000);
    const ch = supabase
      .channel("admin-live-tests")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_live_execution_tests" }, () => void loadRows())
      .subscribe();
    return () => {
      window.removeEventListener(PRODUCTION_MODE_EVENT, re);
      window.clearInterval(id);
      supabase.removeChannel(ch);
    };
  }, []);

  const execMode = getExecutionMode();
  const finalEligible = isFinalLiveActivationEligible();
  const reviewOn = reviewAccessModeEnabled;
  const adminTestingActive = execMode === "admin_live_test";

  const updateMode = async (mode: ExecutionMode) => {
    try { await setExecutionMode(mode); toast.success(`execution_mode → ${mode}`); }
    catch (e: any) { toast.error(e?.message || "Failed to update execution mode"); }
  };

  const permissionBlocked = permState.status === "blocked_trade_disabled";
  const updatePermStatus = async (status: ExecutionPermissionStatus, reason?: string) => {
    try {
      await setExecutionPermissionStatus(status, reason);
      const next = await refreshExecutionPermissionStatus();
      setPermState(next);
      toast.success(`execution_permission_status → ${status}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update permission status");
    }
  };


  // Derive per-test-type aggregate status from DB rows. A type is "pass" if
  // the most recent row with that type has status='pass'; "retest_required"
  // when the latest row failed only due to a closed/unavailable market session;
  // otherwise the most-recent state shows.
  const isRetestRequired = (r: AdminLiveTestRow | undefined): boolean => {
    if (!r || r.status !== "fail") return false;
    const ev = (r.evidence_json ?? {}) as Record<string, unknown>;
    if (ev.finalActivationBlocker === false && ev.retestRequired === true) return true;
    const klass = String(ev.classification ?? "");
    return klass === "order_rejected_market_closed"
      || klass === "order_rejected_trade_disabled_outside_session";
  };
  const matrixState = useMemo(() => {
    const out: Record<AdminTestType, { status: "pending" | "pass" | "fail" | "retest_required"; rowCount: number; lastAt: string | null }> = {} as any;
    for (const def of MATRIX) {
      const all = rows.filter((r) => r.test_type === def.id);
      const latest = all[0];
      let status: "pending" | "pass" | "fail" | "retest_required" = "pending";
      if (latest) {
        if (latest.status === "pass") status = "pass";
        else if (isRetestRequired(latest)) status = "retest_required";
        else if (latest.status === "fail") status = "fail";
      }
      out[def.id] = {
        status,
        rowCount: all.length,
        lastAt: latest?.created_at ?? null,
      };
    }
    return out;
  }, [rows]);

  const matrixPassCount = MATRIX.filter((d) => matrixState[d.id]?.status === "pass").length;
  const requiredMet = MATRIX.filter((d) => d.required).every((d) => matrixState[d.id]?.status === "pass");
  const canActivateLive = requiredMet && finalEligible && !permissionBlocked;

  const runVerification = async () => {
    setVerifying(true);
    try {
      const result = await verifyFromAudit();
      toast.info(`Audit scan: ${result.scanned} events`, {
        description: Object.entries(result.byType).map(([k, v]) => `${k}: ${v.pass}p/${v.fail}f`).join(" · ") || "no recent activity",
      });
      await loadRows();
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
    } finally { setVerifying(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Platform</h3>
        </div>
        <Row label="platform_mode" value={getPlatformMode()} tone={reviewOn ? "warn" : "ok"} />
        <Row label="review_access_mode" value={reviewOn ? "ON (staging)" : "OFF"} tone={reviewOn ? "warn" : "ok"} />
        <Row label="live_refresh_enabled" value={isLiveRefreshEnabled() ? "true" : "false"} tone="ok" />
        <Row label="market_data_mode" value={getMarketDataMode()} tone="ok" />
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Execution</h3>
        </div>
        <Row label="execution_mode" value={execMode} tone={execMode === "live" ? "ok" : execMode === "dry_run" ? "danger" : "warn"} />
        <Row label="authorised_live_testers" value="1" tone="ok" />
        <Row label="tester_mt5_login" value={ADMIN_TESTER_MT5_LOGIN} tone="neutral" />
        <Row label="tester_trader_id" value={maskTraderId(ADMIN_TESTER_TRADER_ID)} tone="neutral" />
        <Row label="risk_validation" value="active" tone="ok" />
        <Row label="fresh_tick_validation" value="active" tone="ok" />
        <Row label="confirmation_coordinator" value="active" tone="ok" />
        <Row label="kill_switch" value="available" tone="ok" />
        <Row label="trading_layer_cooldown" value={cooldown > 0 ? `${Math.ceil(cooldown / 1000)}s remaining` : "clear"} tone={cooldown > 0 ? "warn" : "ok"} />
        <Row
          label="client_live_execution"
          value={permissionBlocked ? "BLOCKED — TL/broker trade-disabled" : execMode === "live" ? "ENABLED" : "disabled pending verification"}
          tone={permissionBlocked ? "danger" : execMode === "live" ? "ok" : "warn"}
        />
        <Row label="final_live_test_passed" value={finalEligible ? "yes" : "no"} tone={finalEligible ? "ok" : "warn"} />
        <Row
          label="final_live_activation_eligible"
          value={finalEligible && !permissionBlocked ? "yes" : "no"}
          tone={finalEligible && !permissionBlocked ? "ok" : "warn"}
        />
        <Row
          label="execution_permission_status"
          value={permState.status}
          tone={permState.status === "blocked_trade_disabled" ? "danger" : permState.status === "cleared_for_retest" ? "ok" : "warn"}
        />
        <Row
          label="external_blocker"
          value={permissionBlocked ? "TL_OR_BROKER_TRADE_DISABLED" : "none"}
          tone={permissionBlocked ? "danger" : "ok"}
        />
      </Card>

      {permissionBlocked && (
        <Card className="p-4 border-red-500/50 bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-300">
              Execution contract discrepancy — APPLICATION_VS_DIRECT_TL_EXECUTION_MISMATCH
            </h3>
          </div>
          <p className="text-[11px] text-red-200/90 leading-relaxed mb-3">
            Live execution paused: Trading Layer directly placed <code>EURUSD BUY 0.01</code> successfully through
            route 559a12e4-16d8-4db3-be48-40fbea54bcfe (order <code>1169085428</code>, retcode 10008
            TRADE_RETCODE_PLACED, confirmed in MT5 login 87943580 / InfinoxLimited-MT5Live), while earlier
            application-submitted EURUSD SELL orders returned <code>TRADE_RETCODE_TRADE_DISABLED</code> (10017).
            Account/symbol eligibility interpretation and the application's outbound mutation contract are
            under review. Buy/Sell remain disabled in the platform until the application-vs-direct delta is
            resolved.
          </p>
          <p className="text-[11px] text-amber-300 mb-3">
            account.trade_mode=2 was previously misread as SYMBOL_TRADE_MODE_SHORTONLY. It is in fact
            ACCOUNT_TRADE_MODE_REAL — informational only. Directional gating is now per-symbol only.
          </p>
          {permState.reason && (
            <p className="text-[10px] text-red-200/70 font-mono mb-3">reason: {permState.reason}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!window.confirm("Clear upstream block? Only do this after Trading Layer / broker has confirmed the EURUSD SELL TRADE_DISABLED contradiction is resolved. This action is audited.")) return;
                updatePermStatus("cleared_for_retest", "Clear Upstream Block After Broker Confirmation — manually acknowledged by admin after Trading Layer / INFINOX resolution.");
              }}
            >
              Clear Upstream Block After Broker Confirmation
            </Button>
            <Button size="sm" variant="ghost" onClick={() => updatePermStatus("unknown", "Reset to unknown pending re-investigation.")}>
              Reset to unknown
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const payload = {
                  title: "Trading Layer Execution Rejection Evidence — MT5 87943580 — EURUSD SELL",
                  exportedAt: new Date().toISOString(),
                  mt5: { login: "87943580", server: "InfinoxLimited-MT5Live" },
                  verifiedExecutionRoute: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
                  symbol: { displaySymbol: "EURUSD", resolvedBrokerSymbol: "EURUSD" },
                  side: "sell",
                  volume: 0.01,
                  pretradeReadOnlyState: {
                    tradeAllowed: true,
                    accountTradeModeRaw: 2,
                    accountTradeMode: "ACCOUNT_TRADE_MODE_REAL",
                    symbolTradeModeRaw: 4,
                    symbolTradeMode: "SYMBOL_TRADE_MODE_FULL",
                    sellReady: true,
                    buyReady: false,
                  },
                  freshTickAtSubmission: {
                    source: "trading_layer_latest_tick",
                    bid: 1.16321,
                    ask: 1.16332,
                    requestedPrice: 1.16321,
                    ageMsThreshold: 15000,
                  },
                  attempts: [
                    {
                      attempt: 1,
                      adminTestId: "dc4b6690-7f8c-4417-8eb1-fced2dbff100",
                      auditEventId: "78821bde-f13f-4f8f-83a5-ad680070693c",
                      submittedAtUtc: "2026-05-26T21:59:46.342Z",
                      retcode: 10017,
                      retcodeName: "TRADE_RETCODE_TRADE_DISABLED",
                      retcodeDescription: "Trade is disabled",
                      brokerAccepted: false,
                      mt5Confirmed: false,
                      positionOpened: false,
                    },
                    {
                      attempt: 2,
                      adminTestId: "958cc603-3dd5-4c70-8a66-5615488858d3",
                      auditEventId: "5f56fdf9-15d6-40ec-a440-28605ab939df",
                      submittedAtUtc: "2026-05-26T22:05:53.171Z",
                      retcode: 10017,
                      retcodeName: "TRADE_RETCODE_TRADE_DISABLED",
                      retcodeDescription: "Trade is disabled",
                      brokerAccepted: false,
                      mt5Confirmed: false,
                      positionOpened: false,
                      latencyMs: 2179,
                    },
                  ],
                  policyVersions: {
                    execution: "TL_EXACT_SYMBOL_OPERATION_INTENT_V1_2026_05_26",
                    freshTick: "FRESH_TICK_SERVER_AUTHORITATIVE_V1_2026_05_26",
                  },
                  classification: "broker_rejected_trade_disabled_after_verified_pretrade",
                  finalActivationBlocker: true,
                  retestRequired: false,
                  noSecretsIncluded: true,
                  questionsForTradingLayer: [
                    "Why does the read-only permission metadata for MT5 87943580 / EURUSD report account trade_mode=2 (ACCOUNT_TRADE_MODE_REAL, informational) and symbol trade_mode=4 (FULL), yet the live SELL mutation returns 10017 TRADE_RETCODE_TRADE_DISABLED?",
                    "Is there an account-level or symbol-level execution flag (e.g. expert/API trading disabled, group restriction, session restriction) that is not surfaced through the symbols / account endpoints?",
                    "Is the account in an investor/read-only state, or is API trading disabled at the broker level for this login?",
                    "Is the verified execution route 559a12e4-16d8-4db3-be48-40fbea54bcfe the correct route for live order submission for MT5 login 87943580 on InfinoxLimited-MT5Live?",
                    "What is the broker-side action required to enable SELL execution for EURUSD on this account, and how can we re-validate before retesting?",
                  ],
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `tl-execution-rejection-evidence-87943580-EURUSD-SELL-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
            >
              Download Escalation Evidence (JSON)
            </Button>
          </div>
        </Card>
      )}

      {!permissionBlocked && permState.status === "cleared_for_retest" && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-amber-200 leading-relaxed">
              Execution permission marked <strong>cleared_for_retest</strong>. Admin live Buy/Sell is re-enabled —
              a single 0.01 EURUSD market order is the recommended next proof. Re-block immediately if a TRADE_DISABLED
              rejection recurs.
            </p>
            <Button size="sm" variant="outline" onClick={() => updatePermStatus("blocked_trade_disabled", "Manually re-blocked.")}>
              Re-block
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Admin actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={adminTestingActive ? "default" : "outline"} disabled={adminTestingActive} onClick={() => updateMode("admin_live_test")}>
            {adminTestingActive ? "Admin Live Testing Active" : "Activate Admin Live Testing"}
          </Button>
          <Button size="sm" variant="outline" disabled={!adminTestingActive} onClick={() => updateMode("controlled_live_test")}>
            Deactivate Admin Live Testing
          </Button>
          <Button size="sm" variant="ghost" onClick={() => updateMode("dry_run")}>Force Dry Run</Button>
          <Button size="sm" variant="default" disabled={!canActivateLive || execMode === "live"} onClick={() => updateMode("live")} title={!canActivateLive ? "Required matrix items must pass" : ""}>
            Activate Live Client Execution
          </Button>
          <Button size="sm" variant="ghost" onClick={runVerification} disabled={verifying}>
            <RefreshCw className={`h-3 w-3 mr-1 ${verifying ? "animate-spin" : ""}`} />
            Run Verification From Audit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const payload = {
                title: "Trading Layer Execution Rejection Evidence — MT5 87943580 — EURUSD SELL",
                exportedAt: new Date().toISOString(),
                mt5: { login: "87943580", server: "InfinoxLimited-MT5Live" },
                verifiedExecutionRoute: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
                symbol: { displaySymbol: "EURUSD", resolvedBrokerSymbol: "EURUSD" },
                side: "sell",
                volume: 0.01,
                pretradeReadOnlyState: {
                  tradeAllowed: true,
                  accountTradeModeRaw: 2,
                  accountTradeMode: "ACCOUNT_TRADE_MODE_REAL",
                  symbolTradeModeRaw: 4,
                  symbolTradeMode: "SYMBOL_TRADE_MODE_FULL",
                  sellReady: true,
                  buyReady: false,
                },
                freshTickAtSubmission: {
                  source: "trading_layer_latest_tick",
                  bid: 1.16321,
                  ask: 1.16332,
                  requestedPrice: 1.16321,
                  ageMsThreshold: 15000,
                },
                attempts: [
                  {
                    attempt: 1,
                    adminTestId: "dc4b6690-7f8c-4417-8eb1-fced2dbff100",
                    auditEventId: "78821bde-f13f-4f8f-83a5-ad680070693c",
                    submittedAtUtc: "2026-05-26T21:59:46.342Z",
                    retcode: 10017,
                    retcodeName: "TRADE_RETCODE_TRADE_DISABLED",
                    retcodeDescription: "Trade is disabled",
                    brokerAccepted: false,
                    mt5Confirmed: false,
                    positionOpened: false,
                  },
                  {
                    attempt: 2,
                    adminTestId: "958cc603-3dd5-4c70-8a66-5615488858d3",
                    auditEventId: "5f56fdf9-15d6-40ec-a440-28605ab939df",
                    submittedAtUtc: "2026-05-26T22:05:53.171Z",
                    retcode: 10017,
                    retcodeName: "TRADE_RETCODE_TRADE_DISABLED",
                    retcodeDescription: "Trade is disabled",
                    brokerAccepted: false,
                    mt5Confirmed: false,
                    positionOpened: false,
                    latencyMs: 2179,
                  },
                ],
                policyVersions: {
                  execution: "TL_EXACT_SYMBOL_OPERATION_INTENT_V1_2026_05_26",
                  freshTick: "FRESH_TICK_SERVER_AUTHORITATIVE_V1_2026_05_26",
                },
                classification: "broker_rejected_trade_disabled_after_verified_pretrade",
                finalActivationBlocker: true,
                retestRequired: false,
                noSecretsIncluded: true,
                questionsForTradingLayer: [
                  "Why does read-only permission metadata report account trade_mode=2 (ACCOUNT_TRADE_MODE_REAL, informational) and symbol trade_mode=4 (FULL) for EURUSD, yet the live SELL mutation returns 10017 TRADE_RETCODE_TRADE_DISABLED?",
                  "Is there an account-level or symbol-level execution flag (expert/API trading disabled, group restriction, session restriction) not surfaced via symbols/account endpoints?",
                  "Is the account in investor/read-only state, or is API trading disabled at the broker level for MT5 login 87943580?",
                  "Is verified execution route 559a12e4-16d8-4db3-be48-40fbea54bcfe correct for live order submission for MT5 login 87943580 on InfinoxLimited-MT5Live?",
                  "What broker-side action is required to enable SELL execution for EURUSD on this account, and how can we re-validate before retesting?",
                ],
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `tl-execution-rejection-evidence-87943580-EURUSD-SELL-${Date.now()}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
          >
            Download Escalation Evidence (JSON)
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {finalEligible ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Final live test passed</Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400"><AlertTriangle className="h-3 w-3" /> Awaiting required matrix items</Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          “Activate Live Client Execution” unlocks only after the required minimum of the Live Test Matrix below is green.
          Status is derived from the database (admin_live_execution_tests). Backend risk validation, kill switch,
          fresh-tick gates and the reconciliation coordinator remain the authoritative enforcement layer in all modes.
        </p>
      </Card>

      <AdminControlledRetestEntryPassCard />

      <AdminFinalLifecycleValidationCard />
      <AdminLivePositionMirrorDiagnostic />

      <AdminControlledRetestCard />


      <AdminExecutionEligibilityCard />

      <AdminLiveTestLimitsCard />

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Live Test Matrix</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">{matrixPassCount}/{MATRIX.length} pass</Badge>
        </div>
        {loading && rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Loading test history…</p>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const readinessTone: Record<Readiness, string> = {
                ready: "border-emerald-500/40 text-emerald-300",
                gated_pending: "border-amber-500/40 text-amber-300",
                implemented_if_confirmed: "border-sky-500/40 text-sky-300",
                blocked_cap: "border-orange-500/40 text-orange-300",
                not_ready: "border-red-500/40 text-red-300",
              };
              return (
                <div key={section.title}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-mono uppercase tracking-wider rounded border px-1.5 py-0.5 ${readinessTone[section.readiness]}`}>
                      {section.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 leading-relaxed">{section.note}</p>
                  <div className="grid gap-1">
                    {section.items.map((def) => {
                      const st = matrixState[def.id];
                      const latest = rows.find((r) => r.test_type === def.id);
                      const tone =
                        st.status === "pass" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : st.status === "retest_required" ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : st.status === "fail" ? "bg-red-500/10 border-red-500/40 text-red-300"
                        : "bg-muted/20 border-border/40 text-muted-foreground";
                      const statusLabel = st.status === "retest_required" ? "RETEST REQUIRED" : st.status.toUpperCase();
                      return (
                        <div key={def.id} className={`rounded border px-2 py-1.5 text-left text-[11px] font-mono ${tone}`}>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              {def.label}
                              {def.required && <span className="text-[9px] uppercase tracking-wider opacity-70">required</span>}
                              <span className="text-[9px] opacity-60">{st.rowCount} run{st.rowCount === 1 ? "" : "s"}</span>
                            </span>
                            <span className="uppercase">{statusLabel}</span>
                          </div>
                          {st.status === "retest_required" && (
                            <div className="mt-0.5 text-[9.5px] text-amber-200/90">
                              Reason: market unavailable/closed at time of broker rejection. Final activation blocker: No, pending valid-session retest.
                            </div>
                          )}
                          {latest && (
                            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] opacity-75">
                              {latest.confirmation_status && <span>conf: {latest.confirmation_status}</span>}
                              {latest.position_ticket && <span>pos#: {latest.position_ticket}</span>}
                              {latest.order_id && <span>order#: {latest.order_id}</span>}
                              {latest.trade_id && <span>trade: {latest.trade_id.slice(0, 8)}…</span>}
                              {latest.latency_ms != null && <span>latency: {latest.latency_ms}ms</span>}
                              {latest.tested_at && <span>at: {new Date(latest.tested_at).toLocaleTimeString()}</span>}
                              {latest.rate_limit_hit && <span className="text-amber-300">rate-limited</span>}
                              {latest.account_id_mismatch && <span className="text-red-300">ACCOUNT_ID_MISMATCH</span>}
                              {latest.duplicate_detected && <span className="text-red-300">duplicate</span>}
                              {latest.notes && <span className="col-span-2 opacity-60">note: {latest.notes}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
          Status reflects the latest <code>admin_live_execution_tests</code> row per type. Tests are recorded
          automatically by real MT5 actions; there is no manual pass override. Use “Run Verification From Audit”
          to reconcile against <code>execution_audit_events</code>.
        </p>
      </Card>

    </div>
  );
};

export default AdminProductionModeTab;
