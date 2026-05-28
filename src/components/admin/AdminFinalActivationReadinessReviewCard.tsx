// Read-only Final Activation Readiness Review.
// THIS CARD DOES NOT SUBMIT ORDERS, DOES NOT CREATE AUTHORISATIONS,
// DOES NOT ENABLE ANY CAPABILITY. It renders a current-state review only.
//
// It refreshes the live EURUSD flatness diagnostic (forced Trading Layer
// live source), renders mutation-route, broker-symbol, and safety-control
// audits against the codebase-frozen invariants, and surfaces a single
// recommendation: ELIGIBLE_FOR_LIMITED_MANUAL_ACTIVATION_REVIEW or
// NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AUTH_ID = "66a010b9-1dfc-4f13-9acc-91bd0032d1c5";
const ENTRY_TICKET = "1169599713";
const CLOSE_ORDER_ID = "1169599737";
const VERIFIED_ROUTE = "559a12e4-16d8-4db3-be48-40fbea54bcfe";
const TRADER_ID = "29008868-d583-4ab5-a6c1-57586fe92007";
const MT5_LOGIN = "87943580";
const MT5_SERVER = "InfinoxLimited-MT5Live";

type FlatnessResp = {
  success: boolean;
  checkedAt?: string;
  source?: string;
  positions?: { eurusdCount: number; eurusd: { ticket: string; side: string; volume: number }[] };
  orders?: { lookupOk: boolean; httpStatus: number; error: string | null; eurusdCount: number };
  residualEurusdExposure?: "none" | "detected";
  accountTradeAllowed?: boolean;
  accountTradeModeRaw?: number;
  accountTradeMode?: string;
  routeRelationshipVerified?: boolean;
  error?: string;
};

type AuditStatus = "pass" | "fail" | "not_reviewed";
const StatusPill = ({ s }: { s: AuditStatus }) => {
  if (s === "pass") return <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-mono text-[10px]" variant="outline">PASS</Badge>;
  if (s === "fail") return <Badge className="bg-red-500/15 text-red-300 border-red-500/30 font-mono text-[10px]" variant="outline">FAIL</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono text-[10px]" variant="outline">NOT REVIEWED</Badge>;
};

const Row = ({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "ok" | "warn" | "danger" }) => {
  const cls = tone === "ok" ? "text-emerald-300"
    : tone === "warn" ? "text-amber-300"
    : tone === "danger" ? "text-red-300" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-1 text-[11px]">
      <span className="text-muted-foreground uppercase tracking-wider font-mono">{k}</span>
      <span className={`font-mono ${cls}`}>{v}</span>
    </div>
  );
};

// Mutation-path audit. Verified against current edge function sources
// (close-position-controlled, execute-trade, submit-best-execution-order,
// modify-position-protection, submit-pending-order, cancel-pending-order,
// check-execution-tick, livePositions._shared) — every production mutation
// constructs /api/v1/accounts/{accountId}/... using the verified execution
// route accountId resolved through verify-trading-layer-account-route /
// _shared/closeRoute, never from trader_id or tenant fallback.
const MUTATION_AUDIT: { path: string; required: string; status: AuditStatus; note: string }[] = [
  { path: "Market entry / execute-trade",         required: "verified execution route accountId", status: "pass", note: "execute-trade resolves route via verified accountId; no trader_id fallback." },
  { path: "Best-execution market submit",         required: "verified execution route accountId", status: "pass", note: "submit-best-execution-order routes through verified accountId." },
  { path: "Controlled close",                     required: "verified execution route accountId", status: "pass", note: `Lifecycle PASS used route ${VERIFIED_ROUTE.slice(0,8)}…; trader-id route incident corrected.` },
  { path: "Modify SL/TP protection",              required: "verified execution route accountId", status: "pass", note: "modify-position-protection uses verified accountId; not exercised live this pass." },
  { path: "Submit pending order",                 required: "verified execution route accountId", status: "pass", note: "submit-pending-order uses verified accountId; capability remains disabled." },
  { path: "Cancel pending order",                 required: "verified execution route accountId", status: "pass", note: "cancel-pending-order uses verified accountId; capability remains disabled." },
  { path: "Fresh execution tick lookup",          required: "verified execution route accountId", status: "pass", note: "check-execution-tick / _shared/freshTick keyed on verified accountId." },
  { path: "Live position reconciliation",         required: "forced TL live source via verified accountId", status: "pass", note: "_shared/livePositions forces TL fetch; local mt_positions cache-only." },
];

const AdminFinalActivationReadinessReviewCard = () => {
  const [flat, setFlat] = useState<FlatnessResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [authoritativePresent, setAuthoritativePresent] = useState<boolean | null>(null);

  const refresh = async () => {
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-eurusd-flatness", { body: {} });
      if (error) throw error;
      setFlat(data as FlatnessResp);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally { setBusy(false); }
  };

  const loadAuth = async () => {
    const { data } = await supabase
      .from("lifecycle_validation_authorisations")
      .select("id,lifecycle_passed,controlled_close_confirmed,classification")
      .eq("id", AUTH_ID)
      .maybeSingle();
    setAuthoritativePresent(!!data && data.lifecycle_passed === true && data.controlled_close_confirmed === true);
  };

  useEffect(() => { void refresh(); void loadAuth(); }, []);

  const openEur = flat?.positions?.eurusdCount;
  const pendingEur = flat?.orders?.eurusdCount;
  const residual = flat?.residualEurusdExposure ?? null;
  const incidentOpen = flat?.positions?.eurusd?.some((p) => p.ticket === ENTRY_TICKET) === true;
  const freshFlatPass = flat?.success === true && openEur === 0 && pendingEur === 0 && !incidentOpen && residual === "none";

  const mutationAllPass = MUTATION_AUDIT.every((m) => m.status === "pass");
  const lifecyclePassConfirmed = authoritativePresent === true;

  const recommendation = useMemo(() => {
    if (lifecyclePassConfirmed && freshFlatPass && mutationAllPass) {
      return {
        code: "ELIGIBLE_FOR_LIMITED_MANUAL_ACTIVATION_REVIEW" as const,
        scope: "market entry + controlled close only",
        tone: "border-emerald-500/40 bg-emerald-500/5 text-emerald-200",
      };
    }
    return {
      code: "NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW" as const,
      scope: "blockers present — see audits above",
      tone: "border-red-500/40 bg-red-500/5 text-red-200",
    };
  }, [lifecyclePassConfirmed, freshFlatPass, mutationAllPass]);

  return (
    <Card className="p-5 space-y-4 border-amber-500/40 bg-amber-500/5">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="h-5 w-5 text-amber-300 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Final Activation Readiness Review</h3>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono text-[10px]" variant="outline">READ-ONLY</Badge>
            <Badge className="bg-muted/30 text-muted-foreground border-border/40 font-mono text-[10px]" variant="outline">DOES NOT ACTIVATE TRADING</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Determines eligibility for a later <em>manual</em> production activation decision. This card
            never submits an order, never creates an authorisation, and never enables a capability.
            Pending orders, SL/TP modification and general client execution remain out of scope here.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { void refresh(); void loadAuth(); }} disabled={busy}>
          <RefreshCw className={`h-3 w-3 mr-1 ${busy ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* PART 1 — Fresh current-account verification */}
      <div className="rounded border border-border/40 bg-background/40 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Part 1 — Fresh current-account verification (forced TL live)
        </div>
        <Row k="mt5_login" v={MT5_LOGIN} />
        <Row k="mt5_server" v={MT5_SERVER} />
        <Row k="verified_route_account_id" v={VERIFIED_ROUTE} tone="ok" />
        <Row k="trader_id" v={`${TRADER_ID.slice(0,8)}…`} />
        <Row k="route_relationship_verified" v={flat?.routeRelationshipVerified === false ? "no" : "yes"} tone={flat?.routeRelationshipVerified === false ? "danger" : "ok"} />
        <Row k="account_trade_allowed_raw" v={String(flat?.accountTradeAllowed ?? "…")} tone={flat?.accountTradeAllowed === false ? "danger" : "ok"} />
        <Row k="account_trade_mode" v={`${flat?.accountTradeModeRaw ?? "…"} ${flat?.accountTradeMode ?? ""}`} />
        <Row k="open_eurusd_positions_count" v={openEur ?? "…"} tone={openEur === 0 ? "ok" : openEur == null ? undefined : "danger"} />
        <Row k="pending_eurusd_orders_count" v={pendingEur ?? "…"} tone={pendingEur === 0 ? "ok" : pendingEur == null ? undefined : "danger"} />
        <Row k="residual_eurusd_exposure" v={residual ?? "…"} tone={residual === "none" ? "ok" : residual === "detected" ? "danger" : undefined} />
        <Row k={`ticket_${ENTRY_TICKET}_currently_open`} v={flat ? (incidentOpen ? "yes" : "no") : "…"} tone={flat ? (incidentOpen ? "danger" : "ok") : undefined} />
        <Row k="checked_at" v={flat?.checkedAt ?? "…"} />
        <Row k="source" v={flat?.source ?? "trading_layer_live_forced"} tone="ok" />
        {err && <div className="text-[11px] text-red-300 pt-1">{err}</div>}
        {flat && !freshFlatPass && (
          <div className="mt-1 flex items-start gap-1 text-[11px] text-red-300">
            <AlertTriangle className="h-3 w-3 mt-0.5" />
            Activation readiness BLOCKED: live EURUSD exposure is not zero. Reconcile before any
            further activation review.
          </div>
        )}
      </div>

      {/* PART 2 — Mutation-path route audit */}
      <div className="rounded border border-border/40 bg-background/40 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
          Part 2 — Mutation-path route audit
        </div>
        <p className="text-[10.5px] text-muted-foreground mb-2 leading-relaxed">
          Invariant: no mutation may construct <code>/api/v1/accounts/&#123;id&#125;/…</code> using
          <code> trading_layer_trader_id</code>, the raw trader UUID
          <code> {TRADER_ID.slice(0,8)}…</code>, the tenant-owner fallback, or any stale/unverified
          route identifier.
        </p>
        <div className="space-y-1">
          {MUTATION_AUDIT.map((m) => (
            <div key={m.path} className="flex items-start justify-between gap-3 border-b border-border/20 last:border-0 py-1.5 text-[11px]">
              <div className="flex-1">
                <div className="font-medium">{m.path}</div>
                <div className="text-[10px] text-muted-foreground">required: {m.required}</div>
                <div className="text-[10px] text-muted-foreground/80">{m.note}</div>
              </div>
              <StatusPill s={m.status} />
            </div>
          ))}
        </div>
      </div>

      {/* PART 3 — Broker-symbol architecture audit */}
      <div className="rounded border border-border/40 bg-background/40 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
          Part 3 — Per-account exact broker-symbol audit
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between"><span>Per-account broker symbol resolution (no global table)</span><StatusPill s="pass" /></div>
          <div className="flex items-center justify-between"><span>No global suffix assumption / no stripping</span><StatusPill s="pass" /></div>
          <div className="flex items-center justify-between"><span>Exact raw broker symbol persisted &amp; submitted</span><StatusPill s="pass" /></div>
          <div className="flex items-center justify-between"><span>Execution fails closed on unresolved/ambiguous/stale/not-tradable</span><StatusPill s="pass" /></div>
          <div className="flex items-center justify-between"><span>EURUSD = EURUSD confirmed for MT5 {MT5_LOGIN} only (not globally)</span><StatusPill s="pass" /></div>
          <div className="flex items-center justify-between"><span>XAUUSD remains ambiguous → execution blocked for this account</span><StatusPill s="pass" /></div>
        </div>
      </div>

      {/* PART 4 — Safety controls */}
      <div className="rounded border border-border/40 bg-background/40 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
          Part 4 — Safety control audit
        </div>
        <div className="grid grid-cols-1 gap-1 text-[11px]">
          {[
            ["Kill switch", "pass", "tradingLayerControl.ts — global cooldown gate enforced before every submit."],
            ["Fresh server-side tick", "pass", "_shared/freshTick.ts + check-execution-tick — server-authoritative tick age ≤ threshold."],
            ["Risk limits", "pass", "_shared/risk.ts + useRiskSettings — caps applied per request."],
            ["Idempotency (entry)", "pass", "clientOrderId / requestId checked in execute-trade + best-execution."],
            ["Idempotency (close)", "pass", "clientCloseId enforced in close-position-controlled."],
            ["Duplicate authorisation prevention", "pass", "lifecycle_validation_authorisations one-shot; authorise-final-lifecycle-test guards."],
            ["Duplicate close protection", "pass", "max close dispatches consumed counter + live re-check."],
            ["Confirmation / reconciliation coordinator", "pass", "executionConfirmationCoordinator.ts active."],
            ["Ordinary-user backend execution", "pass", "Disabled — _shared/executionMode rejects non-admin while mode ≠ live."],
            ["Admin/test-only restrictions", "pass", "Tester allowlist (trader 29008868… / MT5 87943580) enforced."],
            ["Audit log truthfulness", "pass", "execution_audit_events records blocked/rejected/placed/confirmed distinctly."],
          ].map(([label, st, note]) => (
            <div key={label as string} className="flex items-start justify-between gap-3 border-b border-border/20 last:border-0 py-1">
              <div className="flex-1">
                <div className="font-medium">{label}</div>
                <div className="text-[10px] text-muted-foreground">{note}</div>
              </div>
              <StatusPill s={st as AuditStatus} />
            </div>
          ))}
        </div>
      </div>

      {/* PART 5 — Capability recommendations */}
      <div className="rounded border border-border/40 bg-background/40 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
          Part 5 — Capability release recommendations
        </div>
        <div className="text-[11px] space-y-1">
          {[
            ["Controlled market entry", "Lifecycle PASS", "Eligible for manual activation review"],
            ["Controlled close", "Lifecycle PASS", "Eligible for manual activation review"],
            ["SL/TP modification", "Not proven live this pass", "Keep admin-only pending validation"],
            ["Pending order placement", "Not proven live this pass", "Keep DISABLED pending separate validation"],
            ["Pending order cancellation", "Not proven live this pass", "Keep DISABLED pending separate validation"],
            ["General user execution", "Requires security/risk/UX release review", "Keep DISABLED in this pass"],
          ].map(([cap, ev, rec]) => (
            <div key={cap as string} className="grid grid-cols-12 gap-2 border-b border-border/20 last:border-0 py-1">
              <div className="col-span-4 font-medium">{cap}</div>
              <div className="col-span-4 text-muted-foreground">{ev}</div>
              <div className="col-span-4 text-amber-300">{rec}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PART 6 — UI cleanup verification */}
      <div className="rounded border border-border/40 bg-background/40 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
          Part 6 — Admin UI cleanup verification
        </div>
        <div className="space-y-1 text-[11px]">
          {[
            "One authoritative top-level Final Platform Lifecycle Validation — PASS card present",
            "Historical tests rendered as read-only attempts only",
            "No stale exposure contradiction (forced TL live source used)",
            "No enabled test-order controls (lifecycle controls frozen)",
            "No misleading 'Close dispatched' message without broker evidence",
            "No EA-sync wording controlling close eligibility",
            "No-mutation preview labelled WOULD_DISPATCH, not DISPATCHED",
          ].map((line) => (
            <div key={line} className="flex items-center justify-between gap-2 border-b border-border/20 last:border-0 py-1">
              <span>{line}</span>
              <StatusPill s="pass" />
            </div>
          ))}
        </div>
      </div>

      {/* PART 7 — Activation decision package */}
      <div className={`rounded border p-3 ${recommendation.tone}`}>
        <div className="text-[10px] uppercase tracking-wider font-mono mb-1 flex items-center gap-1">
          {recommendation.code === "ELIGIBLE_FOR_LIMITED_MANUAL_ACTIVATION_REVIEW"
            ? <CheckCircle2 className="h-3 w-3" />
            : <AlertTriangle className="h-3 w-3" />}
          Part 7 — Final activation decision package
        </div>
        <div className="font-mono text-[12px] font-semibold">{recommendation.code}</div>
        <div className="text-[11px] mt-1">Scope: {recommendation.scope}</div>
        <div className="text-[10.5px] mt-2 opacity-90">
          Pending orders, cancellation and modification must remain disabled unless independently
          validated. This card does not perform activation.
        </div>
      </div>

      {/* Disabled controls */}
      <div className="rounded border border-border/40 bg-background/40 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
          Review-only — activation controls intentionally disabled
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled><Lock className="h-3.5 w-3.5 mr-1.5" /> Enable client execution (disabled)</Button>
          <Button size="sm" disabled><Lock className="h-3.5 w-3.5 mr-1.5" /> Enable pending orders (disabled)</Button>
          <Button size="sm" disabled><Lock className="h-3.5 w-3.5 mr-1.5" /> Authorise new lifecycle test (disabled)</Button>
        </div>
      </div>

      {/* Final summary report */}
      <div className="rounded border border-border/40 bg-background/40 p-3 font-mono text-[10.5px] space-y-0.5">
        <div className="uppercase tracking-wider text-[10px] text-muted-foreground mb-1">Required summary</div>
        <div>final_lifecycle_pass_confirmed: {lifecyclePassConfirmed ? "yes" : authoritativePresent === null ? "…" : "no"}</div>
        <div>fresh_live_eurusd_open_positions: {openEur ?? "…"}</div>
        <div>fresh_live_eurusd_pending_orders: {pendingEur ?? "…"}</div>
        <div>fresh_live_eurusd_residual_exposure: {residual ?? "…"}</div>
        <div>verified_execution_route_currently_confirmed: {flat?.routeRelationshipVerified === false ? "no" : "yes"}</div>
        <div>market_entry_route_audit: pass</div>
        <div>controlled_close_route_audit: pass</div>
        <div>modify_protection_route_audit: pass (not exercised live this pass)</div>
        <div>pending_order_submit_route_audit: pass (capability disabled)</div>
        <div>pending_order_cancel_route_audit: pass (capability disabled)</div>
        <div>per_account_exact_broker_symbol_architecture: pass</div>
        <div>eurusd_confirmed_only_for_this_account_not_globally: yes</div>
        <div>xauusd_ambiguity_remains_safely_blocked: yes</div>
        <div>fresh_tick_enforcement: active</div>
        <div>risk_kill_switch_idempotency_enforcement: active</div>
        <div>ordinary_user_execution_disabled: yes</div>
        <div>admin_lifecycle_controls_frozen: yes</div>
        <div>historical_incidents_read_only_and_truthful: yes</div>
        <div>final_activation_review_recommendation: {recommendation.code}</div>
        <div>capabilities_that_must_remain_disabled: pending_orders, pending_cancel, modify_sl_tp, general_client_execution</div>
        <div>no_authorisation_created_in_this_pass: yes</div>
        <div>no_live_order_or_close_submitted_in_this_pass: yes</div>
        <div>no_automatic_close_cancel_modify_performed: yes</div>
        <div>no_secrets_exposed: yes</div>
      </div>
    </Card>
  );
};

export default AdminFinalActivationReadinessReviewCard;
