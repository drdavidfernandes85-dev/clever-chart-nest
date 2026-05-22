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
  hasFinalLiveTestPassed,
  setFinalLiveTestPassed,
  isFinalLiveActivationEligible,
  PRODUCTION_MODE_EVENT,
} from "@/lib/productionMode";
import { reviewAccessModeEnabled } from "@/lib/accessMode";
import { getCooldownRemainingMs } from "@/lib/tradingLayerControl";
import { CheckCircle2, AlertTriangle, ShieldCheck, Activity } from "lucide-react";

const Row = ({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "danger" | "neutral" }) => {
  const colors: Record<string, string> = {
    ok: "text-emerald-400",
    warn: "text-amber-400",
    danger: "text-red-400",
    neutral: "text-foreground",
  };
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 text-sm">
      <span className="text-muted-foreground font-mono text-[11px] uppercase tracking-wider">{label}</span>
      <span className={`font-mono ${colors[tone]}`}>{value}</span>
    </div>
  );
};

const AdminProductionModeTab = () => {
  const [, force] = useState(0);
  const [cooldown, setCooldown] = useState(getCooldownRemainingMs());

  useEffect(() => {
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

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Platform</h3>
        </div>
        <Row label="platform_mode" value={getPlatformMode()} tone={reviewOn ? "warn" : "ok"} />
        <Row label="review_access_mode" value={reviewOn ? "ON (staging)" : "OFF"} tone={reviewOn ? "warn" : "ok"} />
        <Row label="access_requirement_mode" value={reviewOn ? "bypassed" : "enforced ($100 min)"} tone={reviewOn ? "warn" : "ok"} />
        <Row label="live_refresh_enabled" value={isLiveRefreshEnabled() ? "true" : "false"} tone="ok" />
        <Row label="market_data_mode" value={getMarketDataMode()} tone="ok" />
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Execution</h3>
        </div>
        <Row label="execution_mode" value={execMode} tone={execMode === "live" ? "ok" : "warn"} />
        <Row label="testing_mode_cap" value="max 0.01 lot / order" tone="neutral" />
        <Row label="kill_switch" value="available" tone="ok" />
        <Row label="confirmation_coordinator" value="active" tone="ok" />
        <Row
          label="trading_layer_cooldown"
          value={cooldown > 0 ? `${Math.ceil(cooldown / 1000)}s remaining` : "clear"}
          tone={cooldown > 0 ? "warn" : "ok"}
        />
        <Row
          label="final_live_test_passed"
          value={finalEligible ? "yes" : "no"}
          tone={finalEligible ? "ok" : "warn"}
        />
        <Row
          label="final_live_activation_eligible"
          value={finalEligible ? "yes" : "no"}
          tone={finalEligible ? "ok" : "warn"}
        />
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Admin actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!reviewOn}
            onClick={() => toast.info("Review Access Mode is already disabled in production. Re-enable via VITE_REVIEW_ACCESS_MODE=true if needed for staging.")}
          >
            Disable Review Access Mode
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isLiveRefreshEnabled()}
            onClick={() => toast.info("Live refresh is already enabled.")}
          >
            Enable Live Refresh
          </Button>
          <Button
            size="sm"
            variant={execMode === "controlled_live_test" ? "default" : "outline"}
            onClick={() => {
              setExecutionMode("controlled_live_test");
              toast.success("Execution mode → controlled_live_test");
            }}
          >
            Enable Controlled Live Test
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={!finalEligible || execMode === "live"}
            onClick={() => {
              if (!finalEligible) return;
              setExecutionMode("live");
              toast.success("Live client execution activated");
            }}
            title={!finalEligible ? "Requires final authenticated 0.01 open/close confirmation test" : ""}
          >
            Activate Live Client Execution
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {finalEligible ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Final live test passed
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400">
              <AlertTriangle className="h-3 w-3" /> Awaiting final authenticated open/close confirmation
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFinalLiveTestPassed(!finalEligible);
              toast.success(`final_live_test_passed → ${!finalEligible}`);
            }}
          >
            Toggle final-test flag
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          “Activate Live Client Execution” remains disabled until a real
          authenticated 0.01 open becomes <code>position_confirmed</code> and
          its close becomes <code>close_confirmed</code> with no
          ACCOUNT_ID_MISMATCH, no duplicate order/close, and response IDs
          persisted. Backend risk validation, kill switch, fresh-tick gates
          and reconciliation integrity are the authoritative enforcement.
        </p>
      </Card>
    </div>
  );
};

export default AdminProductionModeTab;
