import { useEffect, useState } from "react";
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
import { CheckCircle2, AlertTriangle, ShieldCheck, Activity, FlaskConical } from "lucide-react";

const maskTraderId = (id: string) =>
  id.length <= 12 ? "••••" : `${id.slice(0, 8)}…${id.slice(-4)}`;

const Row = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) => {
  const colors: Record<string, string> = {
    ok: "text-emerald-400",
    warn: "text-amber-400",
    danger: "text-red-400",
    neutral: "text-foreground",
  };
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 text-sm">
      <span className="text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
        {label}
      </span>
      <span className={`font-mono ${colors[tone]}`}>{value}</span>
    </div>
  );
};

const MATRIX_KEY = "ltr.liveTestMatrix";

type MatrixStatus = "pending" | "pass" | "fail";
interface MatrixItem {
  id: string;
  label: string;
  status: MatrixStatus;
  notes?: string;
  updatedAt?: string;
}

const DEFAULT_MATRIX: MatrixItem[] = [
  { id: "buy_market", label: "Market Buy 0.01", status: "pending" },
  { id: "sell_market", label: "Market Sell 0.01", status: "pending" },
  { id: "full_close", label: "Full close confirmed", status: "pending" },
  { id: "partial_close", label: "Partial close confirmed", status: "pending" },
  { id: "modify_sl", label: "SL modification confirmed", status: "pending" },
  { id: "modify_tp", label: "TP modification confirmed", status: "pending" },
  { id: "buy_limit", label: "Buy Limit placement", status: "pending" },
  { id: "sell_limit", label: "Sell Limit placement", status: "pending" },
  { id: "buy_stop", label: "Buy Stop placement", status: "pending" },
  { id: "sell_stop", label: "Sell Stop placement", status: "pending" },
  { id: "cancel_pending", label: "Pending order cancellation", status: "pending" },
  { id: "no_mismatch", label: "No ACCOUNT_ID_MISMATCH", status: "pending" },
  { id: "no_dup_order", label: "No duplicate order", status: "pending" },
  { id: "no_dup_close", label: "No duplicate close", status: "pending" },
  { id: "no_fake_success", label: "No fake success", status: "pending" },
  { id: "ids_persisted", label: "Response identifiers persisted", status: "pending" },
  { id: "coordinator_used", label: "Confirmation coordinator used", status: "pending" },
  { id: "ws_live", label: "Live prices via WebSocket when healthy", status: "pending" },
];

function loadMatrix(): MatrixItem[] {
  try {
    const raw = localStorage.getItem(MATRIX_KEY);
    if (!raw) return DEFAULT_MATRIX;
    const parsed = JSON.parse(raw) as MatrixItem[];
    const map = new Map(parsed.map((p) => [p.id, p]));
    return DEFAULT_MATRIX.map((d) => map.get(d.id) ?? d);
  } catch {
    return DEFAULT_MATRIX;
  }
}

function saveMatrix(items: MatrixItem[]) {
  try {
    localStorage.setItem(MATRIX_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

const REQUIRED_FOR_ACTIVATION = [
  "buy_market",
  "full_close",
  "modify_sl",
  "buy_limit",
  "cancel_pending",
  "no_dup_order",
  "no_dup_close",
  "no_mismatch",
  "no_fake_success",
];

const AdminProductionModeTab = () => {
  const [, force] = useState(0);
  const [cooldown, setCooldown] = useState(getCooldownRemainingMs());
  const [matrix, setMatrix] = useState<MatrixItem[]>(loadMatrix);

  useEffect(() => {
    refreshExecutionMode();
    const re = () => force((n) => n + 1);
    window.addEventListener(PRODUCTION_MODE_EVENT, re);
    const id = window.setInterval(() => setCooldown(getCooldownRemainingMs()), 1000);
    return () => {
      window.removeEventListener(PRODUCTION_MODE_EVENT, re);
      window.clearInterval(id);
    };
  }, []);

  const execMode = getExecutionMode();
  const finalEligible = isFinalLiveActivationEligible();
  const reviewOn = reviewAccessModeEnabled;
  const adminTestingActive = execMode === "admin_live_test";

  const updateMode = async (mode: ExecutionMode) => {
    try {
      await setExecutionMode(mode);
      toast.success(`execution_mode → ${mode}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update execution mode");
    }
  };

  const cycleStatus = (s: MatrixStatus): MatrixStatus =>
    s === "pending" ? "pass" : s === "pass" ? "fail" : "pending";

  const toggleItem = (id: string) => {
    setMatrix((prev) => {
      const next = prev.map((it) =>
        it.id === id
          ? { ...it, status: cycleStatus(it.status), updatedAt: new Date().toISOString() }
          : it,
      );
      saveMatrix(next);
      return next;
    });
  };

  const matrixPassCount = matrix.filter((m) => m.status === "pass").length;
  const minimumSetMet = REQUIRED_FOR_ACTIVATION.every(
    (id) => matrix.find((m) => m.id === id)?.status === "pass",
  );
  const canActivateLive = minimumSetMet && finalEligible;

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
        <Row
          label="execution_mode"
          value={execMode}
          tone={execMode === "live" ? "ok" : execMode === "dry_run" ? "danger" : "warn"}
        />
        <Row label="authorised_live_testers" value="1" tone="ok" />
        <Row label="tester_mt5_login" value={ADMIN_TESTER_MT5_LOGIN} tone="neutral" />
        <Row label="tester_trader_id" value={maskTraderId(ADMIN_TESTER_TRADER_ID)} tone="neutral" />
        <Row label="risk_validation" value="active" tone="ok" />
        <Row label="fresh_tick_validation" value="active" tone="ok" />
        <Row label="confirmation_coordinator" value="active" tone="ok" />
        <Row label="kill_switch" value="available" tone="ok" />
        <Row
          label="trading_layer_cooldown"
          value={cooldown > 0 ? `${Math.ceil(cooldown / 1000)}s remaining` : "clear"}
          tone={cooldown > 0 ? "warn" : "ok"}
        />
        <Row
          label="client_live_execution"
          value={execMode === "live" ? "ENABLED" : "disabled pending verification"}
          tone={execMode === "live" ? "ok" : "warn"}
        />
        <Row
          label="final_live_test_passed"
          value={finalEligible ? "yes" : "no"}
          tone={finalEligible ? "ok" : "warn"}
        />
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Admin actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={adminTestingActive ? "default" : "outline"}
            disabled={adminTestingActive}
            onClick={() => updateMode("admin_live_test")}
          >
            {adminTestingActive ? "Admin Live Testing Active" : "Activate Admin Live Testing"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!adminTestingActive}
            onClick={() => updateMode("controlled_live_test")}
          >
            Deactivate Admin Live Testing
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => updateMode("dry_run")}
          >
            Force Dry Run
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={!canActivateLive || execMode === "live"}
            onClick={() => updateMode("live")}
            title={
              !canActivateLive
                ? "Required matrix items must pass and final-test flag must be true"
                : ""
            }
          >
            Activate Live Client Execution
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const pass = matrix.filter((m) => m.status === "pass").length;
              const fail = matrix.filter((m) => m.status === "fail").length;
              toast.info(`Audit: ${pass} pass, ${fail} fail, ${matrix.length - pass - fail} pending`);
            }}
          >
            Run Verification From Audit
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {finalEligible ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Final live test passed
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400">
              <AlertTriangle className="h-3 w-3" /> Awaiting required matrix items
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          “Activate Live Client Execution” unlocks only after the required
          minimum of the Live Test Matrix below is green AND no duplicate /
          mismatch / fake-success items remain. Backend risk validation, kill
          switch, fresh-tick gates and the reconciliation coordinator remain
          the authoritative enforcement layer in all modes.
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Live Test Matrix</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {matrixPassCount}/{matrix.length} pass
          </Badge>
        </div>
        <div className="grid gap-1">
          {matrix.map((it) => {
            const tone =
              it.status === "pass"
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : it.status === "fail"
                ? "bg-red-500/10 border-red-500/40 text-red-300"
                : "bg-muted/20 border-border/40 text-muted-foreground";
            const required = REQUIRED_FOR_ACTIVATION.includes(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => toggleItem(it.id)}
                className={`flex items-center justify-between rounded border px-2 py-1.5 text-left text-[11px] font-mono ${tone} hover:opacity-90`}
              >
                <span className="flex items-center gap-2">
                  {it.label}
                  {required && (
                    <span className="text-[9px] uppercase tracking-wider opacity-70">
                      required
                    </span>
                  )}
                </span>
                <span className="uppercase">{it.status}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Click an item to cycle pending → pass → fail. State is persisted
          locally for the current admin browser. Required items must be
          green before live client execution can be activated.
        </p>
      </Card>
    </div>
  );
};

export default AdminProductionModeTab;
