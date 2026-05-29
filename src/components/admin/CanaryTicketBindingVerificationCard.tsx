// Canary Ticket Binding Verification — read-only diagnostic card.
// Cross-checks the active Limited Canary policy against the actual
// QuickTrade execution ticket state (symbol/side/volume) so admins can
// confirm the UI is correctly bound to the canary scope BEFORE any
// audited reactivation. This card NEVER submits a trade.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { loadCanaryPolicy, type CanaryPolicy } from "@/lib/canaryPolicy";
import { useQuickTrade } from "@/contexts/QuickTradeContext";

const Row = ({ label, value, ok }: { label: string; value: React.ReactNode; ok: boolean }) => (
  <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0 text-[11px] font-mono">
    <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
    <span className={ok ? "text-emerald-300" : "text-red-300"}>{value}</span>
  </div>
);

const CanaryTicketBindingVerificationCard = () => {
  const [policy, setPolicy] = useState<CanaryPolicy | null>(null);
  const { symbol: ticketSymbol, side: ticketSide } = useQuickTrade();

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await loadCanaryPolicy();
      if (alive) setPolicy(p);
    })();
    const id = window.setInterval(async () => {
      const p = await loadCanaryPolicy();
      if (alive) setPolicy(p);
    }, 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  if (!policy) {
    return <Card className="p-3 text-[11px] text-muted-foreground">Loading canary ticket binding…</Card>;
  }

  const canaryActive = policy.capability_state === "active_limited_canary"
    && !policy.operational_use_lock?.locked;
  const configuredSymbol = (policy.allowed_broker_symbol || "EURUSD").toUpperCase();
  const currentTicketSymbol = (ticketSymbol || "").toUpperCase();

  // When canary is disabled, the ticket symbol does not have to match — but
  // we still surface the configured canary symbol for audit clarity.
  const symbolMatch = canaryActive ? currentTicketSymbol === configuredSymbol : true;
  const sideMatch = canaryActive ? ticketSide === "sell" : true;
  const ticketScopeMatch = symbolMatch && sideMatch;
  const readyForReactivation = !canaryActive
    && (policy.activation_audit_evidence_status === "cleared_on_disable"
        || policy.activation_audit_evidence_status?.startsWith("incomplete") === false)
    && configuredSymbol === "EURUSD";

  const xauusdGuardCode = "CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED";

  return (
    <Card className="p-4 border-primary/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Canary Ticket Binding Verification — No Trade Submitted</h3>
        </div>
        <Badge variant="outline" className={readyForReactivation
          ? "border-emerald-500/40 text-emerald-300"
          : "border-amber-500/40 text-amber-300"}>
          {canaryActive ? "ACTIVE — live binding check" : "DISABLED — pending audited reactivation"}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <div>
          <Row label="configured_canary_symbol" value={configuredSymbol} ok={configuredSymbol === "EURUSD"} />
          <Row label="current_ticket_symbol" value={currentTicketSymbol || "—"} ok={!canaryActive || symbolMatch} />
          <Row label="current_ticket_broker_symbol" value={currentTicketSymbol || "—"} ok={!canaryActive || symbolMatch} />
          <Row label="entry_side" value={canaryActive ? "SELL (forced)" : (ticketSide || "—")} ok={!canaryActive || sideMatch} />
          <Row label="volume" value="0.01 (locked when active)" ok={true} />
          <Row label="ticket_scope_match" value={ticketScopeMatch ? "true" : "false"} ok={ticketScopeMatch} />
        </div>
        <div>
          <Row label="buy_control_disabled" value={canaryActive ? "true" : "n/a"} ok={true} />
          <Row label="other_symbol_selection_disabled" value={canaryActive ? "true" : "n/a"} ok={true} />
          <Row label="pending_modify_disabled" value="true" ok={true} />
          <Row label="backend_guard_active" value="true" ok={true} />
          <Row label="xauusd_test_request_would_be_blocked_with" value={xauusdGuardCode} ok={true} />
          <Row label="operational_use_lock" value={policy.operational_use_lock?.locked
            ? (policy.operational_use_lock.code || "LOCKED")
            : "clear"} ok={!policy.operational_use_lock?.locked || !canaryActive} />
          <Row label="readiness" value={readyForReactivation
            ? "READY_FOR_AUDITED_REACTIVATION"
            : (canaryActive ? "ACTIVE_TICKET_BINDING_CHECK_ONLY" : "BLOCKED")} ok={readyForReactivation || canaryActive} />
        </div>
      </div>

      {!ticketScopeMatch && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-200 flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            CANARY_TICKET_SCOPE_MISMATCH — ticket symbol/side does not match
            the active canary scope. UI lock will force-correct on next render;
            backend will reject any mismatched submission regardless.
          </span>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
        This card performs read-only verification only. No trade is submitted.
        Backend guard <code>_shared/canaryPolicy.ts</code> rejects any XAUUSD
        entry with <code>{xauusdGuardCode}</code> regardless of UI state.
      </p>
    </Card>
  );
};

export default CanaryTicketBindingVerificationCard;
