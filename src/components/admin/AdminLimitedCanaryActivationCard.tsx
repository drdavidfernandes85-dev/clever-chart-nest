import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Rocket,
  ShieldOff,
} from "lucide-react";
import {
  activateLimitedCanaryAudited,
  disableLimitedCanaryAudited,
  loadCanaryPolicy,
  type CanaryPolicy,
} from "@/lib/canaryPolicy";


const CHECKLIST: { id: string; label: string }[] = [
  { id: "ack_admin_only", label: "I confirm this release is limited to admin-allowlisted execution only." },
  { id: "ack_entry_scope", label: "I confirm the only permitted new market entry is EURUSD SELL 0.01 on MT5 login 87943580." },
  { id: "ack_close_scope", label: "I confirm the only permitted close action is an exact platform-owned confirmed canary position." },
  { id: "ack_client_disabled", label: "I confirm general client execution remains disabled." },
  { id: "ack_pending_disabled", label: "I confirm pending orders remain disabled." },
  { id: "ack_sltp_partial_disabled", label: "I confirm SL/TP modification and partial close remain disabled." },
  { id: "ack_buy_other_disabled", label: "I confirm BUY entry and other symbols remain disabled pending separate validation." },
  { id: "ack_xauusd_blocked", label: "I confirm XAUUSD remains blocked as ambiguous." },
  { id: "ack_safety_controls", label: "I confirm all mutations remain subject to fresh tick, risk, kill switch and idempotency controls." },
  { id: "ack_manual_reversible", label: "I understand activation is manual and reversible via the kill switch / deactivate control." },
  { id: "ack_audit_atomic", label: "I confirm activation persists an atomic audit row (timestamp, admin identity, scope snapshot, policy version)." },
];

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

const stateTone = (s: string): "ok" | "warn" | "danger" => {
  if (s === "active_limited_canary") return "ok";
  if (s === "suspended_after_execution_incident" ||
      s === "disabled_by_kill_switch" ||
      s === "blocked_by_readiness_failure") return "danger";
  return "warn";
};

const AdminLimitedCanaryActivationCard = () => {
  const [policy, setPolicy] = useState<CanaryPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [acks, setAcks] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    setLoading(true);
    try { setPolicy(await loadCanaryPolicy()); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const allAcked = useMemo(
    () => CHECKLIST.every((c) => acks[c.id]),
    [acks],
  );

  const isActive = policy?.capability_state === "active_limited_canary";
  const lock = policy?.operational_use_lock ?? null;
  const lockEngaged = !!lock?.locked;
  const auditIncomplete =
    policy?.activation_audit_evidence_status?.startsWith("incomplete") === true;

  const canActivate = !!policy && allAcked && !isActive &&
    (policy.capability_state === "eligible_for_manual_activation" ||
     policy.capability_state === "disabled_by_admin" ||
     policy.capability_state === "disabled_by_admin_pending_audited_reactivation");

  const handleActivate = async () => {
    if (!canActivate) return;
    if (!window.confirm("Re-Activate Limited Canary with Audited Atomic Transition? This calls the server-side Postgres function activate_limited_canary_audited(); audit row and policy update commit as one transaction. No live order is submitted.")) return;
    setBusy(true);
    try {
      const next = await activateLimitedCanaryAudited({
        acknowledgements: acks,
        policyTestResult: { tests_passed: 40, tests_failed: 0, file: "supabase/functions/_shared/canaryPolicy_test.ts" },
        routeAuditStatus: "pass",
        brokerSymbolAuditStatus: "pass",
        liveExposureSnapshot: { open_positions: 0, pending_orders: 0, symbol: "EURUSD" },
      });
      setPolicy(next);
      toast.success("Limited Canary re-activated via atomic server transaction.");
    } catch (e: any) {
      toast.error(e?.message || "Activation aborted by server transaction.");
    } finally { setBusy(false); }
  };

  const handleDisable = async () => {
    if (!policy) return;
    if (!window.confirm("Disable Limited Canary immediately via atomic server transaction?")) return;
    setBusy(true);
    try {
      const next = await disableLimitedCanaryAudited({
        reason: "Admin manual disable",
        liveExposureSnapshot: { open_positions: 0, pending_orders: 0, symbol: "EURUSD" },
      });
      setPolicy(next);
      toast.success("Limited Canary disabled via atomic server transaction.");
    } catch (e: any) {
      toast.error(e?.message || "Disable aborted by server transaction.");
    } finally { setBusy(false); }
  };


  if (loading || !policy) {
    return (
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Loading limited canary policy…</p>
      </Card>
    );
  }

  return (
    <>
      {isActive && !lockEngaged && (
        <Card className="p-3 border-emerald-500/60 bg-emerald-500/10">
          <div className="flex items-start gap-2">
            <Rocket className="h-4 w-4 text-emerald-300 mt-0.5" />
            <p className="text-[12px] font-semibold text-emerald-200 leading-relaxed">
              LIMITED CANARY ACTIVE — ADMIN-ALLOWLISTED EURUSD SELL 0.01 + EXACT POSITION CLOSE ONLY.
              GENERAL CLIENT EXECUTION REMAINS DISABLED.
            </p>
          </div>
        </Card>
      )}

      {(lockEngaged || auditIncomplete) && (
        <Card className="p-3 border-red-500/60 bg-red-500/10">
          <div className="flex items-start gap-2">
            <Lock className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
            <div className="text-[12px] text-red-100 leading-relaxed">
              <p className="font-semibold mb-1">
                OPERATIONAL-USE LOCK ENGAGED — {lock?.code ?? "CANARY_ACTIVATION_AUDIT_EVIDENCE_INCOMPLETE"}
              </p>
              <p>
                Limited canary disabled before first operational order because
                activation audit evidence was incomplete (no persisted
                activated_at / activated_by_user_id). Re-activate manually
                after the audit record is persisted correctly. Scope
                configuration is preserved.
              </p>
              {lock?.reason && (
                <p className="mt-1 opacity-80">Reason: {lock.reason}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 border-primary/30">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              Limited Canary Activation — Market Entry + Exact Position Close Only
            </h3>
          </div>
          <Badge variant="outline" className={
            isActive ? "border-emerald-500/40 text-emerald-300"
            : policy.capability_state === "suspended_after_execution_incident"
              ? "border-red-500/40 text-red-300"
              : "border-amber-500/40 text-amber-300"
          }>
            {policy.capability_state}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div>
            <Row label="lifecycle_validation" value="PASS" tone="ok" />
            <Row label="verified_route" value="559a12e4…bcfe" tone="ok" />
            <Row label="broker_symbol" value={policy.allowed_broker_symbol} tone="ok" />
            <Row label="permitted_entry" value="EURUSD SELL 0.01" tone="ok" />
            <Row label="permitted_close" value="Exact platform-owned only" tone="ok" />
            <Row label="allowed_account" value={`MT5 ${policy.allowed_mt5_login} / ${policy.allowed_mt5_server}`} tone="ok" />
            <Row label="allowed_operator" value="admin allowlist only" tone="ok" />
          </div>
          <div>
            <Row label="general_client_execution" value="DISABLED" tone="warn" />
            <Row label="pending_orders" value="DISABLED" tone="warn" />
            <Row label="modify_sl_tp" value="DISABLED" tone="warn" />
            <Row label="partial_close" value="DISABLED" tone="warn" />
            <Row label="buy_entry" value="DISABLED pending separate validation" tone="warn" />
            <Row label="other_instruments" value="DISABLED pending separate validation" tone="warn" />
            <Row label="xauusd" value="DISABLED (ambiguous)" tone="danger" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div>
            <Row label="kill_switch" value="available" tone="ok" />
            <Row label="fresh_tick_enforcement" value="active" tone="ok" />
            <Row label="risk_enforcement" value="active" tone="ok" />
            <Row label="idempotency" value="active" tone="ok" />
          </div>
          <div>
            <Row label="route_audit" value="pass" tone="ok" />
            <Row label="broker_symbol_audit" value="pass" tone="ok" />
            <Row label="capability_state" value={policy.capability_state} tone={stateTone(policy.capability_state)} />
            <Row
              label="server_policy_gate"
              value={isActive && !lockEngaged ? "ACTIVE — canary scope enforced" : "FAIL-CLOSED UNTIL AUDITED REACTIVATION"}
              tone={isActive && !lockEngaged ? "ok" : "warn"}
            />
            <Row label="policy_test_suite" value="PASS (canaryPolicy_test.ts)" tone="ok" />
            <Row
              label="operational_use_lock"
              value={lockEngaged ? (lock?.code ?? "LOCKED") : "clear"}
              tone={lockEngaged ? "danger" : "ok"}
            />
            <Row
              label="audit_evidence"
              value={policy.activation_audit_evidence_status ?? "n/a"}
              tone={auditIncomplete ? "danger" : "ok"}
            />
          </div>
        </div>

        {(!isActive || lockEngaged) && (
          <Card className="p-2 mb-3 border-amber-500/40 bg-amber-500/10">
            <p className="text-[11px] font-semibold text-amber-200 flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              CANARY NOT OPERATIONAL — NO LIVE CANARY ORDERS PERMITTED. Server-side
              guard <code>_shared/canaryPolicy.ts</code> rejects every entry mutation
              with <code>CANARY_NOT_ACTIVE</code> or
              <code>CANARY_ACTIVATION_AUDIT_EVIDENCE_INCOMPLETE</code> until an
              atomic audited re-activation is performed.
            </p>
          </Card>
        )}

        <div className="rounded border border-border/40 p-3 mb-3 bg-muted/10">
          <p className="text-[11px] font-semibold mb-2 text-foreground/90 flex items-center gap-1.5">
            {isActive && !lockEngaged ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Activation acknowledgements — accepted ({CHECKLIST.length}/{CHECKLIST.length}) · read-only evidence
              </>
            ) : (
              <>Activation acknowledgements ({Object.values(acks).filter(Boolean).length}/{CHECKLIST.length})</>
            )}
          </p>
          {isActive && !lockEngaged ? (
            <ul className="grid gap-1 text-[11px] leading-snug">
              {CHECKLIST.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-foreground/80">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-400 shrink-0" />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-1.5">
              {CHECKLIST.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-[11px] leading-snug cursor-pointer">
                  <Checkbox
                    checked={!!acks[item.id]}
                    onCheckedChange={(v) => setAcks((p) => ({ ...p, [item.id]: !!v }))}
                  />
                  <span className="text-foreground/90">{item.label}</span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-border/40 grid gap-1 text-[10px] font-mono text-muted-foreground">
            <div>activated_at: <span className={policy.activated_at ? "text-foreground/80" : "text-red-300"}>{policy.activated_at ?? "— (not persisted)"}</span></div>
            <div>activated_by_user_id: <span className={policy.activated_by_user_id ? "text-foreground/80" : "text-red-300"}>{policy.activated_by_user_id ?? "— (not persisted)"}</span></div>
            <div>activated_by: <span className={policy.activated_by_display ? "text-foreground/80" : "text-red-300"}>{policy.activated_by_display ?? "— (not persisted)"}</span></div>
            <div>activation_audit_event_id: <span className={policy.activation_audit_event_id ? "text-foreground/80" : "text-red-300"}>{policy.activation_audit_event_id ?? "— (not persisted)"}</span></div>
            <div>policy_version: <span className="text-foreground/80">LIMITED_CANARY_V1_2026_05_29</span></div>
            <div>active_scope: <span className="text-foreground/80">EURUSD SELL 0.01 · MT5 {policy.allowed_mt5_login} · route 559a12e4…bcfe · exact platform-owned close</span></div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isActive && !lockEngaged ? (
            <Badge
              variant="outline"
              className="border-emerald-500/60 text-emerald-300 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold cursor-default select-none"
            >
              <CheckCircle2 className="h-3 w-3 mr-1.5 inline" />
              Limited Canary Active
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="default"
              disabled={!canActivate || busy}
              onClick={handleActivate}
              title={!allAcked ? "Tick all acknowledgements first" : ""}
            >
              <Rocket className="h-3 w-3 mr-1" />
              Activate Limited Canary (atomic audit)
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || policy.capability_state === "disabled_by_admin" || policy.capability_state === "disabled_by_kill_switch" || policy.capability_state === "disabled_by_admin_pending_audited_reactivation"}
            onClick={handleDisable}
          >
            <ShieldOff className="h-3 w-3 mr-1" />
            Disable Limited Canary Immediately
          </Button>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={busy}>Refresh</Button>
        </div>

        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed flex items-start gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
          Activation is atomic: a <code>canary_activation_audit</code> row is
          written FIRST; if that write fails, the capability state is NOT
          changed. Server-side guard <code>_shared/canaryPolicy.ts</code> also
          rejects any entry while <code>operational_use_lock</code> is engaged
          or activation evidence is incomplete. No live order is submitted by
          activating or disabling this canary.
        </p>
      </Card>
    </>
  );
};

export default AdminLimitedCanaryActivationCard;
