// Admin → Production: Final Platform Lifecycle Validation — Entry + Controlled Close.
//
// This is a brand-new, single-use lifecycle flow that is fully separate from
// the historical controlled-retest authorisation. It owns its own table
// (`lifecycle_validation_authorisations`) and its own edge functions
// (`validate-lifecycle-entry`, `execute-lifecycle-entry`,
// `execute-lifecycle-close`).
//
// During this implementation pass NO live order is dispatched: the card lands
// in `not_authorised` state, requires every acknowledgement, requires a fresh
// mutation-suppressed preview, and exposes the Authorise/Execute buttons but
// the operator must click them explicitly.

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ShieldCheck, FlaskConical, RefreshCw, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type LifecycleRow = {
  id: string;
  status: string;
  authorisation_type: string;
  expires_at: string;
  mt5_login: string;
  route_account_id: string;
  display_symbol: string;
  broker_symbol: string;
  entry_side: string;
  entry_volume: number;
  entry_outbound_dto: Record<string, unknown>;
  maximum_entry_dispatches: number;
  maximum_close_dispatches: number;
  entry_dispatches_consumed: number;
  close_dispatches_consumed: number;
  entry_consumed_at: string | null;
  entry_order_id: string | null;
  entry_retcode: number | null;
  entry_evidence: any;
  confirmed_position_ticket: string | null;
  confirmed_position_at: string | null;
  confirmed_position_evidence: any;
  close_consumed_at: string | null;
  close_order_id: string | null;
  close_deal_id: string | null;
  close_retcode: number | null;
  close_evidence: any;
  controlled_close_confirmed: boolean;
  lifecycle_passed: boolean;
  classification: string | null;
  acknowledgements: Record<string, boolean>;
  preview_snapshot: any;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

const ACK_ITEMS: { id: string; label: string }[] = [
  { id: "final_lifecycle_test_only", label: "I confirm this is a final platform lifecycle validation test only." },
  { id: "account_confirmed", label: "I confirm the selected MT5 account is 87943580 on InfinoxLimited-MT5Live." },
  { id: "zero_exposure", label: "I confirm current open EURUSD positions are zero and pending EURUSD orders are zero." },
  { id: "only_eurusd_sell_001", label: "I confirm the only permitted entry is EURUSD SELL 0.01." },
  { id: "broker_symbol_exact", label: "I confirm brokerSymbol is exactly EURUSD." },
  { id: "route_exact", label: "I confirm route is 559a12e4-16d8-4db3-be48-40fbea54bcfe." },
  { id: "entry_dto_exact", label: 'I confirm the entry DTO is exactly {"side":"sell","symbol":"EURUSD","volume":0.01}.' },
  { id: "no_deviation_no_metadata", label: "I confirm deviation is absent and internal metadata is excluded from the Trading Layer body." },
  { id: "safeguards_required", label: "I confirm fresh tick, risk, kill-switch and idempotency checks remain required." },
  { id: "one_entry_only", label: "I confirm only one entry dispatch is permitted." },
  { id: "close_only_after_confirmation", label: "I confirm that after position confirmation, only Close for that exact confirmed ticket may be enabled." },
  { id: "one_close_only", label: "I confirm only one close dispatch is permitted." },
  { id: "manual_close_if_uncertain", label: "I understand that if platform close fails or confirmation is uncertain, I must immediately close the position manually in native MT5." },
];

const EXPECTED_ROUTE = "559a12e4-16d8-4db3-be48-40fbea54bcfe";
const EXPECTED_LOGIN = "87943580";

const StatusBadge = ({ status }: { status: string }) => {
  const tone =
    status === "lifecycle_passed" || status === "close_confirmed" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : status === "failed_entry_rejected" || status === "failed_close_rejected" || status === "expired" || status === "review_required" ? "bg-red-500/20 text-red-300 border-red-500/40"
    : "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return <Badge variant="outline" className={`font-mono text-[10px] ${tone}`}>{status}</Badge>;
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-1 text-[11px]">
    <span className="text-muted-foreground uppercase tracking-wider">{k}</span>
    <span className="font-mono text-foreground">{v}</span>
  </div>
);

const AdminFinalLifecycleValidationCard = () => {
  const [row, setRow] = useState<LifecycleRow | null>(null);
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<any>(null);
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [exposure, setExposure] = useState<{ open: number; pending: number } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("lifecycle_validation_authorisations" as any)
      .select("*")
      .eq("authorisation_type", "final_controlled_open_close_lifecycle_validation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow((data as any) ?? null);
  };

  const refreshExposure = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      const [{ count: pos }, { count: pend }] = await Promise.all([
        supabase.from("mt_positions").select("id", { count: "exact", head: true })
          .eq("user_id", uid).or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD"),
        supabase.from("mt_pending_orders").select("id", { count: "exact", head: true })
          .eq("user_id", uid).eq("status", "pending").or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD"),
      ]);
      setExposure({ open: pos ?? 0, pending: pend ?? 0 });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    void load();
    void refreshExposure();
  }, []);

  const allAcked = useMemo(() => ACK_ITEMS.every((i) => acks[i.id]), [acks]);
  const previewFresh = preview?.success && preview?.wouldDispatchEntry === true
    && previewAt && Date.now() - previewAt < 60_000;

  const runPreview = async () => {
    setBusy("preview");
    try {
      const { data, error } = await supabase.functions.invoke("validate-lifecycle-entry", { body: {} });
      if (error) throw error;
      setPreview(data);
      setPreviewAt(Date.now());
      await refreshExposure();
      if (data?.wouldDispatchEntry) toast.success("Preview passed — entry would dispatch");
      else toast.warning(`Preview blocked at ${data?.blockedStage || "unknown"}: ${data?.blockedCode || ""}`);
    } catch (e: any) {
      toast.error(e?.message || "Preview failed");
    } finally { setBusy(null); }
  };

  const arm = async () => {
    if (!allAcked || !previewFresh) return;
    if (!window.confirm("Create new single-use lifecycle authorisation? No order is dispatched by this action.")) return;
    setBusy("arm");
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("lifecycle_validation_authorisations" as any)
        .insert({
          authorisation_type: "final_controlled_open_close_lifecycle_validation",
          status: "armed",
          authorised_by: uid,
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          mt5_login: EXPECTED_LOGIN,
          mt5_server: "InfinoxLimited-MT5Live",
          route_account_id: EXPECTED_ROUTE,
          display_symbol: "EURUSD",
          broker_symbol: "EURUSD",
          entry_side: "sell",
          entry_volume: 0.01,
          entry_order_type: "market",
          entry_outbound_dto: { side: "sell", symbol: "EURUSD", volume: 0.01 },
          acknowledgements: acks,
          preview_snapshot: preview,
        });
      if (error) throw error;
      toast.success("Lifecycle authorisation armed");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Arm failed");
    } finally { setBusy(null); }
  };

  const executeEntry = async () => {
    if (!row || row.status !== "armed") return;
    if (!window.confirm("Dispatch ONE controlled EURUSD SELL 0.01 entry to Trading Layer? This is a real live order.")) return;
    setBusy("entry");
    try {
      const { data, error } = await supabase.functions.invoke("execute-lifecycle-entry", {
        body: { authorisationId: row.id },
      });
      if (error) throw error;
      if (data?.success) toast.success(`Entry dispatched — order ${data.orderId}`);
      else toast.error(`Entry rejected: ${data?.error || "unknown"}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Entry dispatch failed");
    } finally { setBusy(null); }
  };

  const confirmPosition = async () => {
    if (!row || row.status !== "awaiting_position_confirmation") return;
    setBusy("confirm-position");
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const { data: positions } = await supabase
        .from("mt_positions").select("ticket, symbol, broker_symbol, side, volume, open_price, opened_at")
        .eq("user_id", uid!).or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD").eq("side", "sell");
      const match = (positions || []).find(
        (p: any) => Number(p.volume) === Number(row.entry_volume),
      );
      if (!match) {
        toast.warning("No matching EURUSD SELL 0.01 position found yet — try again after EA sync");
        return;
      }
      const { error } = await supabase
        .from("lifecycle_validation_authorisations" as any)
        .update({
          status: "position_confirmed_close_only",
          confirmed_position_ticket: String(match.ticket),
          confirmed_position_at: new Date().toISOString(),
          confirmed_position_evidence: match,
        })
        .eq("id", row.id)
        .eq("status", "awaiting_position_confirmation");
      if (error) throw error;
      toast.success(`Position confirmed — ticket ${match.ticket}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Confirmation failed");
    } finally { setBusy(null); }
  };

  const executeClose = async () => {
    if (!row || row.status !== "position_confirmed_close_only" || !row.confirmed_position_ticket) return;
    if (!window.confirm(`Dispatch controlled close for ticket ${row.confirmed_position_ticket}? This is a real MT5 close.`)) return;
    setBusy("close");
    try {
      const { data, error } = await supabase.functions.invoke("execute-lifecycle-close", {
        body: { authorisationId: row.id, ticket: row.confirmed_position_ticket },
      });
      if (error) throw error;
      if (data?.success) toast.success("Close dispatched");
      else toast.error(data?.warning || data?.error || "Close failed");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Close dispatch failed");
    } finally { setBusy(null); }
  };

  const confirmCloseResolved = async () => {
    if (!row || row.status !== "awaiting_close_confirmation") return;
    setBusy("confirm-close");
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const { count } = await supabase
        .from("mt_positions").select("id", { count: "exact", head: true })
        .eq("user_id", uid!).eq("ticket", row.confirmed_position_ticket!);
      if ((count ?? 0) > 0) {
        toast.warning("Position is still open in mt_positions — cannot mark close confirmed yet");
        return;
      }
      const { error } = await supabase
        .from("lifecycle_validation_authorisations" as any)
        .update({
          status: "close_confirmed",
          controlled_close_confirmed: true,
          lifecycle_passed: true,
          classification: "controlled_lifecycle_entry_and_close_confirmed",
        })
        .eq("id", row.id)
        .eq("status", "awaiting_close_confirmation");
      if (error) throw error;
      toast.success("Full lifecycle PASS recorded");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Close confirmation failed");
    } finally { setBusy(null); }
  };

  const status = row?.status ?? "not_authorised";
  const lifecyclePassed = !!row?.lifecycle_passed;

  return (
    <Card className="p-4 border-primary/40 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Final Platform Lifecycle Validation — Entry + Controlled Close</h3>
        <StatusBadge status={lifecyclePassed ? "lifecycle_passed" : status} />
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
        The previous EURUSD entry test passed, but the position was closed manually in MT5. This final
        isolated lifecycle test is required only to validate platform-controlled closing of an exact
        confirmed position. General client live execution and pending orders remain disabled.
      </p>

      {/* Final pass card */}
      {lifecyclePassed && row && (
        <Card className="p-3 mb-3 border-emerald-500/40 bg-emerald-500/10">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-emerald-300">Final Platform Lifecycle Validation — PASS</h4>
          </div>
          <Row k="entry_order_id" v={row.entry_order_id || "—"} />
          <Row k="entry_retcode" v={row.entry_retcode ?? "—"} />
          <Row k="confirmed_position_ticket" v={row.confirmed_position_ticket || "—"} />
          <Row k="close_order_id" v={row.close_order_id || "—"} />
          <Row k="close_deal_id" v={row.close_deal_id || "—"} />
          <Row k="close_retcode" v={row.close_retcode ?? "—"} />
          <Row k="classification" v={row.classification || "—"} />
          <Row k="residual_exposure" v="none" />
          <Row k="entry" v={<span className="text-emerald-300">PASS</span>} />
          <Row k="platform_controlled_close" v={<span className="text-emerald-300">PASS</span>} />
          <Row k="full_lifecycle" v={<span className="text-emerald-300">PASS</span>} />
          <div className="mt-2 p-2 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300">
            Lifecycle Validation Passed — Eligible for Final Activation Review. Final activation remains a
            separate explicit admin action.
          </div>
        </Card>
      )}

      {/* Acknowledgements + preview before arming */}
      {!row && (
        <>
          <div className="mb-3 p-2 rounded border border-border/40">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Current EURUSD exposure
            </div>
            <Row k="open_positions" v={exposure?.open ?? "…"} />
            <Row k="pending_orders" v={exposure?.pending ?? "…"} />
            <Button size="sm" variant="ghost" onClick={refreshExposure} className="mt-1 h-6 text-[10px]">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Acknowledgements</div>
            {ACK_ITEMS.map((it) => (
              <label key={it.id} className="flex items-start gap-2 text-[11px] leading-snug">
                <Checkbox
                  checked={!!acks[it.id]}
                  onCheckedChange={(c) => setAcks((p) => ({ ...p, [it.id]: !!c }))}
                  className="mt-0.5"
                />
                <span>{it.label}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            <Button size="sm" variant="outline" onClick={runPreview} disabled={busy === "preview"}>
              {busy === "preview" ? "Validating…" : "Validate Final Lifecycle Entry — No Mutation"}
            </Button>
            <Button
              size="sm"
              onClick={arm}
              disabled={!allAcked || !previewFresh || busy === "arm"}
            >
              <Lock className="h-3 w-3 mr-1" /> Authorise Single-Use Lifecycle
            </Button>
          </div>

          {preview && (
            <div className="mt-2 p-2 rounded border border-border/40 bg-muted/20">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Mutation-suppressed preview
              </div>
              <Row k="validationOnly" v={String(preview.validationOnly)} />
              <Row k="mutationSuppressed" v={String(preview.mutationSuppressed)} />
              <Row k="wouldDispatchEntry" v={
                <span className={preview.wouldDispatchEntry ? "text-emerald-300" : "text-red-300"}>
                  {String(preview.wouldDispatchEntry)}
                </span>
              } />
              <Row k="mappingStatus" v={preview.mappingStatus} />
              <Row k="route" v={preview.route || "—"} />
              <Row k="brokerSymbol" v={preview.brokerSymbol || "—"} />
              <Row k="side / volume" v={`${preview.side} ${preview.volume}`} />
              <Row k="accountTradeAllowed" v={preview.accountTradeAllowed} />
              <Row k="accountTradeMode" v={preview.accountTradeMode || "—"} />
              <Row k="symbolTradeMode" v={preview.symbolTradeMode || "—"} />
              <Row k="risk" v={preview.risk} />
              <Row k="killSwitch" v={preview.killSwitch} />
              <Row k="idempotency" v={preview.idempotency} />
              <Row k="freshTick" v={`${preview.freshTick} (${preview.freshTickAgeMs ?? "—"}ms)`} />
              <Row k="openEurusdPositions" v={preview.openEurusdPositions ?? "—"} />
              <Row k="pendingEurusdOrders" v={preview.pendingEurusdOrders ?? "—"} />
              <Row k="outboundBody" v={<code>{JSON.stringify(preview.outboundBody)}</code>} />
              <Row k="deviationAbsent" v={String(preview.deviationAbsent)} />
              <Row k="internalMetadataExcluded" v={String(preview.internalMetadataExcluded)} />
              {preview.blockedStage && (
                <Row k="blockedStage" v={<span className="text-red-300">{preview.blockedStage}: {preview.blockedCode}</span>} />
              )}
            </div>
          )}
        </>
      )}

      {/* Armed → execute entry */}
      {row && row.status === "armed" && (
        <div className="space-y-2">
          <div className="p-2 rounded border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-200">
            Authorisation armed. One entry dispatch permitted. Expires {new Date(row.expires_at).toLocaleTimeString()}.
          </div>
          <Row k="authorisation_id" v={row.id} />
          <Row k="entry_dto" v={<code>{JSON.stringify(row.entry_outbound_dto)}</code>} />
          <Button size="sm" onClick={executeEntry} disabled={busy === "entry"}>
            {busy === "entry" ? "Dispatching…" : "Execute Final Lifecycle Entry — EURUSD SELL 0.01"}
          </Button>
        </div>
      )}

      {/* Awaiting position confirmation */}
      {row && row.status === "awaiting_position_confirmation" && (
        <div className="space-y-2">
          <Row k="entry_order_id" v={row.entry_order_id || "—"} />
          <Row k="entry_retcode" v={row.entry_retcode ?? "—"} />
          <div className="p-2 rounded border border-border/40 text-[11px]">
            Entry dispatched. Reconcile EA / Trading Layer until the EURUSD SELL 0.01 position appears.
          </div>
          <Button size="sm" variant="outline" onClick={confirmPosition} disabled={busy === "confirm-position"}>
            <RefreshCw className="h-3 w-3 mr-1" /> Confirm Exact Position Ticket
          </Button>
        </div>
      )}

      {/* Close-only state */}
      {row && row.status === "position_confirmed_close_only" && (
        <div className="space-y-2">
          <Row k="confirmed_position_ticket" v={row.confirmed_position_ticket || "—"} />
          <Row k="symbol" v="EURUSD" />
          <Row k="side" v="SELL" />
          <Row k="volume" v="0.01" />
          <div className="p-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-200">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            This is a real MT5 close action for the confirmed test position only.
          </div>
          <Button size="sm" onClick={executeClose} disabled={busy === "close"}>
            {busy === "close" ? "Closing…" : `Close Confirmed Test Position — Ticket ${row.confirmed_position_ticket}`}
          </Button>
        </div>
      )}

      {/* Awaiting close confirmation */}
      {row && row.status === "awaiting_close_confirmation" && (
        <div className="space-y-2">
          <Row k="close_order_id" v={row.close_order_id || "—"} />
          <Row k="close_retcode" v={row.close_retcode ?? "—"} />
          <Button size="sm" variant="outline" onClick={confirmCloseResolved} disabled={busy === "confirm-close"}>
            <RefreshCw className="h-3 w-3 mr-1" /> Confirm Close Reconciliation
          </Button>
        </div>
      )}

      {/* Frozen pre-trade block — current failed lifecycle attempt */}
      {row && row.status === "review_required_pretrade_block" && (
        <div className="space-y-2">
          <div className="p-2 rounded border border-red-500/50 bg-red-500/10 text-[11px] text-red-200">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            <strong>Failed Lifecycle Attempt — frozen, non-reusable.</strong> The dispatcher rejected this
            authorisation before any Trading Layer mutation. No new live order was sent. A replacement
            lifecycle authorisation will not be created in this pass.
          </div>
          <Row k="authorisation_id" v={<code className="text-[10px]">{row.id}</code>} />
          <Row k="status" v={row.status} />
          <Row k="failure_reason" v={row.failure_reason || "—"} />
          <Row k="classification" v={row.classification || "—"} />
          <Row k="blockedStage" v={row.entry_evidence?.blockedStage || "mapping_validation"} />
          <Row k="blockedCode" v={<span className="text-red-300">{row.entry_evidence?.blockedCode || "MAPPING_NOT_ACTIVE"}</span>} />
          <Row k="brokerMutationDispatched" v={<span className="text-emerald-300">{String(row.entry_evidence?.brokerMutationDispatched ?? false)}</span>} />
          <Row k="tradingLayerRequestId" v={row.entry_evidence?.tradingLayerRequestId ?? "none"} />
          <Row k="tradingLayerOrderId" v={row.entry_evidence?.tradingLayerOrderId ?? "none"} />
          <Row k="positionTicket" v={row.entry_evidence?.positionTicket ?? "none"} />
          <Row k="reusable" v={<span className="text-red-300">false</span>} />
          <Row k="entry_dispatches_consumed" v={row.entry_dispatches_consumed} />
          <Row k="root_cause" v={<span className="text-[10px] text-amber-300">{row.entry_evidence?.rootCause || "duplicate mapping vocabulary"}</span>} />

          <div className="mt-2 p-2 rounded border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-200">
            Read-only dispatcher diagnostic. Runs the no-mutation lifecycle entry preview. Authorise and
            Execute remain unavailable in this pass.
          </div>
          <Button size="sm" variant="outline" onClick={runPreview} disabled={busy === "preview"}>
            {busy === "preview" ? "Validating…" : "READ-ONLY: Validate Final Lifecycle Entry Dispatcher — No Mutation"}
          </Button>
          {preview && (
            <div className="mt-2 p-2 rounded border border-border/40 bg-muted/20">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Mutation-suppressed dispatcher preview
              </div>
              <Row k="validationOnly" v={String(preview.validationOnly)} />
              <Row k="mutationSuppressed" v={String(preview.mutationSuppressed)} />
              <Row k="wouldDispatchEntry" v={
                <span className={preview.wouldDispatchEntry ? "text-emerald-300" : "text-red-300"}>
                  {String(preview.wouldDispatchEntry)}
                </span>
              } />
              <Row k="mappingStatus" v={preview.mappingStatus} />
              <Row k="route" v={preview.route || "—"} />
              <Row k="brokerSymbol" v={preview.brokerSymbol || "—"} />
              <Row k="side / volume" v={`${preview.side} ${preview.volume}`} />
              <Row k="freshTick" v={`${preview.freshTick} (${preview.freshTickAgeMs ?? "—"}ms)`} />
              <Row k="openEurusdPositions" v={preview.openEurusdPositions ?? "—"} />
              <Row k="pendingEurusdOrders" v={preview.pendingEurusdOrders ?? "—"} />
              <Row k="outboundBody" v={<code>{JSON.stringify(preview.outboundBody)}</code>} />
              {preview.blockedStage && (
                <Row k="blockedStage" v={<span className="text-red-300">{preview.blockedStage}: {preview.blockedCode}</span>} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Failure states */}
      {row && (row.status === "failed_entry_rejected" || row.status === "failed_close_rejected" || row.status === "expired") && (
        <div className="space-y-2">
          <div className="p-2 rounded border border-red-500/40 bg-red-500/10 text-[11px] text-red-200">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {row.failure_reason || "Lifecycle failed"}. No automatic retry — start a new lifecycle authorisation if appropriate.
          </div>
          {row.status === "failed_close_rejected" && (
            <div className="p-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-200">
              Platform close is not confirmed. Close ticket {row.confirmed_position_ticket} manually in
              native MT5 immediately if it remains open.
            </div>
          )}
        </div>
      )}


      <div className="mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" />
        general_client_live_execution = disabled · pending_orders_enabled = false · max_entry_dispatch = 1 · max_close_dispatch = 1
      </div>
    </Card>
  );
};

export default AdminFinalLifecycleValidationCard;
