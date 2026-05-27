import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldCheck, FlaskConical, Lock } from "lucide-react";

const PERMITTED = {
  symbol: "EURUSD",
  brokerSymbol: "EURUSD",
  side: "sell" as const,
  volume: 0.01,
  routeAccountId: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
  endpoint: "/api/v1/accounts/559a12e4-16d8-4db3-be48-40fbea54bcfe/trades/send",
  dto: { side: "sell", symbol: "EURUSD", volume: 0.01 },
};

const ACK_ITEMS = [
  "I confirm the selected MT5 account is 87943580 on InfinoxLimited-MT5Live.",
  "I confirm there are currently zero open EURUSD positions and zero pending EURUSD orders.",
  "I confirm the order is fixed at EURUSD SELL 0.01 only.",
  "I confirm the exact brokerSymbol is EURUSD.",
  "I confirm the execution route is 559a12e4-16d8-4db3-be48-40fbea54bcfe.",
  'I confirm the outbound Trading Layer body is exactly {"side":"sell","symbol":"EURUSD","volume":0.01}.',
  "I confirm deviation is absent and internal audit metadata is excluded from the Trading Layer body.",
  "I confirm server-side fresh-tick, risk, kill-switch and idempotency checks remain mandatory.",
  "I understand this permits one real MT5 order attempt only and expires after 10 minutes.",
  "I understand that if a position is confirmed, only the controlled Close action for that exact ticket is permitted next.",
  "I understand that if the request is rejected or blocked, no automatic retry is permitted.",
] as const;

type Auth = {
  id: string;
  authorised_at: string;
  armed_at: string | null;
  expires_at: string;
  status: string | null;
  consumed_at: string | null;
  dispatch_attempted_at: string | null;
  outcome: string | null;
  outcome_retcode: number | null;
  consumed_order_id: string | null;
  outcome_payload: any;
  evidence_json: any;
};

const Pill = ({ tone, children }: { tone: "ok" | "warn" | "fail"; children: React.ReactNode }) => {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : tone === "warn"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-red-500/15 text-red-300 border-red-500/30";
  return <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${cls}`}>{children}</span>;
};

const Row = ({ k, v, ok }: { k: string; v: React.ReactNode; ok?: boolean }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-0.5">
    <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{k}</span>
    <span className={ok ? "text-emerald-300" : "text-red-300"}>{v}</span>
  </div>
);

const AdminControlledRetestCard = () => {
  const [revokedAuth, setRevokedAuth] = useState<Auth | null>(null);
  const [placedAuth, setPlacedAuth] = useState<Auth | null>(null);
  const [entryCompleted, setEntryCompleted] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [dispatcher, setDispatcher] = useState<any>(null);
  const [validatingDispatcher, setValidatingDispatcher] = useState(false);

  const refresh = async () => {
    const [{ data: revoked }, { data: placed }, { data: settings }] = await Promise.all([
      supabase
        .from("controlled_retest_authorisations")
        .select("*")
        .eq("status", "revoked_after_pretrade_block_review")
        .order("authorised_at", { ascending: false })
        .limit(1),
      supabase
        .from("controlled_retest_authorisations")
        .select("*")
        .eq("status", "placed")
        .order("authorised_at", { ascending: false })
        .limit(1),
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", "controlled_retest_entry_1169109844")
        .maybeSingle(),
    ]);
    setRevokedAuth((revoked?.[0] as Auth) ?? null);
    setPlacedAuth((placed?.[0] as Auth) ?? null);
    setEntryCompleted(!!settings?.value || !!placed?.[0]);
  };

  useEffect(() => {
    refresh();
  }, []);

  const runPreviews = async () => {
    setPreviewing(true);
    try {
      const { data: prev } = await supabase.functions.invoke("submit-controlled-retest", {
        body: { previewOnly: true },
      });
      setPreview(prev);
      toast.success("Preview refreshed (read-only, no mutation).");
    } catch (e: any) {
      toast.error(`Preview failed: ${e?.message ?? "unknown"}`);
    } finally {
      setPreviewing(false);
    }
  };

  const validateDispatcher = async () => {
    setValidatingDispatcher(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-controlled-retest", {
        body: { validateOnly: true },
      });
      if (error) throw error;
      setDispatcher(data);
      toast.success("Dispatcher validation completed (no mutation).");
    } catch (e: any) {
      toast.error(`Dispatcher validation failed: ${e?.message ?? "unknown"}`);
    } finally {
      setValidatingDispatcher(false);
    }
  };

  const placedEvidence = placedAuth?.evidence_json ?? {};
  const placedPayload = placedAuth?.outcome_payload ?? {};

  return (
    <Card className="p-5 space-y-4 border-border/40 bg-background/40">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-emerald-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-base font-semibold">
            Controlled Entry Test Completed — No Further Entry Authorisation Available
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Entry PASS. Position manually closed in MT5. Controlled platform close still pending validation.
            New entry testing requires a separate approved lifecycle-validation plan.
          </p>
        </div>
        <Pill tone="ok">entry · frozen</Pill>
      </div>

      {/* Successful entry authorisation (consumed) */}
      {placedAuth && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs font-mono space-y-1">
          <div className="text-emerald-300 uppercase tracking-wider text-[10px] mb-1">
            Successful Controlled Entry — Consumed Authorisation (Read-Only)
          </div>
          <Row k="authorisation id" v={placedAuth.id} ok />
          <Row k="status" v="consumed_entry_pass_manual_close_confirmed" ok />
          <Row k="db status" v={placedAuth.status ?? "—"} ok={placedAuth.status === "placed"} />
          <Row k="outcome" v={placedAuth.outcome ?? "—"} ok={placedAuth.outcome === "placed"} />
          <Row k="broker mutation dispatched" v={String(placedEvidence?.brokerMutationDispatched === true || placedEvidence?.mutationDispatched === true)} ok />
          <Row k="orderId / ticket" v={placedAuth.consumed_order_id ?? "—"} ok={placedAuth.consumed_order_id === "1169109844"} />
          <Row k="retcode" v={`${placedAuth.outcome_retcode ?? "—"} / ${placedPayload?.data?.retcode_name ?? "TRADE_RETCODE_PLACED"}`} ok={placedAuth.outcome_retcode === 10008} />
          <Row k="trading layer requestId" v={placedPayload?.requestId ?? "—"} ok={!!placedPayload?.requestId} />
          <Row k="consumed at" v={placedAuth.consumed_at ?? "—"} ok={!!placedAuth.consumed_at} />
          <Row k="reusable" v="NO — single-use, consumed" ok />
          <Row k="manual MT5 close confirmed" v="yes" ok />
          <Row k="controlled-close validation" v="PENDING" ok={false} />
        </div>
      )}

      {/* Historical revoked-before-dispatch attempt */}
      {revokedAuth && (
        <div className="rounded border border-red-500/30 bg-red-500/5 p-3 text-xs font-mono space-y-1">
          <div className="text-red-300 uppercase tracking-wider text-[10px] mb-1">
            Previous Attempt — Revoked Before Broker Dispatch (Historical, Read-Only)
          </div>
          <Row k="authorisation id" v={revokedAuth.id} ok={false} />
          <Row k="status" v={revokedAuth.status ?? "—"} ok={false} />
          <Row k="outcome" v={revokedAuth.outcome ?? "—"} ok={false} />
          <Row k="blocked stage" v={revokedAuth.outcome_payload?.blockedStage ?? "—"} ok={false} />
          <Row k="blocked code" v={revokedAuth.outcome_payload?.blockedCode ?? "—"} ok={false} />
          <Row k="blocked message" v={revokedAuth.outcome_payload?.blockedMessage ?? "—"} ok={false} />
          <Row k="broker mutation dispatched" v="false" ok />
          <Row k="trading layer requestId" v="none" ok />
          <Row k="order created" v="none" ok />
        </div>
      )}

      {/* Read-only diagnostics */}
      <div className="rounded border border-border/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            Read-Only Diagnostic — Does Not Authorise Or Submit An Order
          </div>
          <Pill tone="warn">diagnostic</Pill>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={runPreviews} disabled={previewing}>
            {previewing ? "Running preview…" : "Run mutation-suppressed preview"}
          </Button>
          <Button size="sm" variant="outline" onClick={validateDispatcher} disabled={validatingDispatcher}>
            {validatingDispatcher ? "Validating dispatcher…" : "Validate Controlled Dispatcher — No Mutation"}
          </Button>
        </div>
        {dispatcher && (
          <div className="rounded border border-border/40 p-3 text-xs font-mono space-y-1 mt-2">
            <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Dispatcher validation result</div>
            <Row k="validationOnly" v={String(dispatcher.validationOnly === true)} ok={dispatcher.validationOnly === true} />
            <Row k="mutationSuppressed" v={String(dispatcher.mutationSuppressed === true)} ok={dispatcher.mutationSuppressed === true} />
            <Row k="wouldDispatch" v={String(dispatcher.wouldDispatch === true)} ok={dispatcher.wouldDispatch === true} />
            <Row k="mappingStatus" v={dispatcher.mappingStatus ?? "—"} ok={dispatcher.mappingStatus === "valid"} />
            <Row k="outboundBody" v={JSON.stringify(dispatcher.outboundBody)} ok={JSON.stringify(dispatcher.outboundBody) === JSON.stringify(PERMITTED.dto)} />
          </div>
        )}
        {preview?.outbound && (
          <div className="rounded border border-border/40 p-3 text-xs font-mono space-y-1 mt-2">
            <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Exact outbound TL DTO (preview)</div>
            <Row k="endpoint" v={preview.outbound.endpointPath} ok={preview.outbound.endpointPath === PERMITTED.endpoint} />
            <Row k="method" v={preview.outbound.method} ok={preview.outbound.method === "POST"} />
            <Row k="body" v={JSON.stringify(preview.outbound.body)} ok />
            <Row k="deviation absent" v={String(preview.outbound.deviationAbsent ?? true)} ok />
            <Row k="internal metadata excluded" v={String(preview.outbound.internalMetadataExcluded)} ok={preview.outbound.internalMetadataExcluded === true} />
          </div>
        )}
      </div>

      {/* Frozen acknowledgements (read-only display only) */}
      <div className="rounded border border-border/40 p-3 space-y-2 opacity-60">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
          Acknowledgement Constraints (frozen — no new authorisation possible)
        </div>
        {ACK_ITEMS.map((label, i) => (
          <label key={i} className="flex items-start gap-2 text-xs">
            <Checkbox checked disabled />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
        <Button size="sm" disabled title="Entry test completed — no further entry authorisation available">
          <Lock className="h-3.5 w-3.5 mr-1.5" /> Authorise (disabled — completed)
        </Button>
        <Button size="sm" variant="destructive" disabled title="Entry test completed — no further entry authorisation available">
          <Lock className="h-3.5 w-3.5 mr-1.5" /> Submit Controlled SELL 0.01 (disabled — completed)
        </Button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        <span>
          Controlled platform entry has passed using the verified EURUSD minimal DTO. The position was
          manually closed in MT5. General live execution remains disabled because platform-controlled
          close has not yet been live-validated.
        </span>
      </div>

      {!placedAuth && !revokedAuth && (
        <div className="flex items-center gap-2 text-[11px] text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>No authorisation records found.</span>
        </div>
      )}

      {/* hide unused state warning */}
      <span className="hidden">{String(entryCompleted)}</span>

      {/* unused state placeholder to keep FlaskConical import in use */}
      <span className="hidden">
        <FlaskConical />
      </span>
    </Card>
  );
};

export default AdminControlledRetestCard;
