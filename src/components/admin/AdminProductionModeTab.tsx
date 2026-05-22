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
  type ExecutionMode,
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

  const loadRows = async () => {
    setLoading(true);
    try { setRows(await listAdminLiveTests(300)); } finally { setLoading(false); }
  };

  useEffect(() => {
    refreshExecutionMode();
    void loadRows();
    const re = () => force((n) => n + 1);
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

  // Derive per-test-type aggregate status from DB rows. A type is "pass" if
  // the most recent row with that type has status='pass'; otherwise the worst-
  // case current state shows.
  const matrixState = useMemo(() => {
    const out: Record<AdminTestType, { status: "pending" | "pass" | "fail"; rowCount: number; lastAt: string | null }> = {} as any;
    for (const def of MATRIX) {
      const all = rows.filter((r) => r.test_type === def.id);
      const latest = all[0];
      out[def.id] = {
        status: latest ? (latest.status === "pass" ? "pass" : latest.status === "fail" ? "fail" : "pending") : "pending",
        rowCount: all.length,
        lastAt: latest?.created_at ?? null,
      };
    }
    return out;
  }, [rows]);

  const matrixPassCount = MATRIX.filter((d) => matrixState[d.id]?.status === "pass").length;
  const requiredMet = MATRIX.filter((d) => d.required).every((d) => matrixState[d.id]?.status === "pass");
  const canActivateLive = requiredMet && finalEligible;

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
        <Row label="client_live_execution" value={execMode === "live" ? "ENABLED" : "disabled pending verification"} tone={execMode === "live" ? "ok" : "warn"} />
        <Row label="final_live_test_passed" value={finalEligible ? "yes" : "no"} tone={finalEligible ? "ok" : "warn"} />
      </Card>

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
          <div className="grid gap-1">
            {MATRIX.map((def) => {
              const st = matrixState[def.id];
              const tone =
                st.status === "pass" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : st.status === "fail" ? "bg-red-500/10 border-red-500/40 text-red-300"
                : "bg-muted/20 border-border/40 text-muted-foreground";
              return (
                <div key={def.id} className={`flex items-center justify-between rounded border px-2 py-1.5 text-left text-[11px] font-mono ${tone}`}>
                  <span className="flex items-center gap-2">
                    {def.label}
                    {def.required && <span className="text-[9px] uppercase tracking-wider opacity-70">required</span>}
                    <span className="text-[9px] opacity-60">{st.rowCount} run{st.rowCount === 1 ? "" : "s"}</span>
                  </span>
                  <span className="uppercase">{st.status}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Status reflects the latest <code>admin_live_execution_tests</code> row per type. Tests are recorded
          automatically when you execute real MT5 actions from the terminal. Use “Run Verification From Audit”
          to reconcile against <code>execution_audit_events</code>.
        </p>
      </Card>
    </div>
  );
};

export default AdminProductionModeTab;
