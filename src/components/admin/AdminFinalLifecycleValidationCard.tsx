// Admin → Production: Final Platform Lifecycle Validation — Entry + Controlled Close.
//
// Separates HISTORICAL terminal authorisations (frozen evidence) from any
// currently ACTIVE single-use authorisation. A new authorisation form is
// rendered only when no active row exists. Historical terminal rows
// (review_required_pretrade_block, failed_*, expired, close_confirmed) are
// displayed for evidence but do not block creation of a replacement.

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ShieldCheck, FlaskConical, RefreshCw, Lock, Archive } from "lucide-react";
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

const ACTIVE_STATUSES = new Set([
  "armed",
  "entry_dispatch_consumed",
  "awaiting_position_confirmation",
  "position_confirmed_close_only",
  "close_dispatch_consumed",
  "awaiting_close_confirmation",
]);

const TERMINAL_STATUSES = new Set([
  "review_required_pretrade_block",
  "failed_entry_rejected",
  "failed_close_rejected",
  "expired",
  "close_confirmed",
  "lifecycle_passed",
]);

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
const EXPECTED_DTO = { side: "sell", symbol: "EURUSD", volume: 0.01 };

const StatusBadge = ({ status }: { status: string }) => {
  const tone =
    status === "lifecycle_passed" || status === "close_confirmed" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : status === "failed_entry_rejected" || status === "failed_close_rejected" || status === "expired" || status === "review_required_pretrade_block" ? "bg-red-500/20 text-red-300 border-red-500/40"
    : status === "not_authorised" ? "bg-muted text-muted-foreground border-border/40"
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
  const [activeRow, setActiveRow] = useState<LifecycleRow | null>(null);
  const [historicalRows, setHistoricalRows] = useState<LifecycleRow[]>([]);
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
      .order("created_at", { ascending: false });
    const rows = (data as any[] | null) ?? [];
    const active = rows.find((r) => ACTIVE_STATUSES.has(r.status)) ?? null;
    const historical = rows.filter((r) => TERMINAL_STATUSES.has(r.status));
    setActiveRow(active);
    setHistoricalRows(historical);
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
  const previewFresh = !!(preview && previewAt && Date.now() - previewAt < 60_000);
  const wouldDispatchEntry = preview?.wouldDispatchEntry === true;
  const dtoExact = !!preview && JSON.stringify(preview.outboundBody) === JSON.stringify(EXPECTED_DTO);
  const routeExact = preview?.route === EXPECTED_ROUTE;
  const mappingValid = preview?.mappingStatus === "valid";
  const brokerExact = preview?.brokerSymbol === "EURUSD";
  const sideExact = preview?.side === "sell";
  const volumeExact = Number(preview?.volume) === 0.01;
  const freshTickPass = preview?.freshTick === "pass";
  const deviationAbsent = preview?.deviationAbsent === true;
  const internalMetadataExcluded = preview?.internalMetadataExcluded === true;
  const exposureZero = (preview?.openEurusdPositions ?? 1) === 0 && (preview?.pendingEurusdOrders ?? 1) === 0;
  const hasActiveLifecycleRow = !!activeRow;
  const isAuthorising = busy === "arm";

  // Per-gate blocker resolution — surfaces the first failing gate so the
  // Authorise button is never inactive without a visible reason.
  const blocker: string | null =
    !preview ? "NO_PREVIEW"
    : !previewFresh ? "PREVIEW_STALE_RE_RUN"
    : !wouldDispatchEntry ? `PREVIEW_BLOCKED_${preview?.blockedCode || preview?.blockedStage || "UNKNOWN"}`
    : !mappingValid ? "MAPPING_NOT_VALID"
    : !routeExact ? "ROUTE_MISMATCH"
    : !brokerExact ? "BROKER_SYMBOL_MISMATCH"
    : !sideExact ? "SIDE_MISMATCH"
    : !volumeExact ? "VOLUME_MISMATCH"
    : !freshTickPass ? "FRESH_TICK_NOT_PASS"
    : !exposureZero ? "EXPOSURE_NON_ZERO"
    : !deviationAbsent ? "DEVIATION_PRESENT"
    : !internalMetadataExcluded ? "INTERNAL_METADATA_PRESENT"
    : !dtoExact ? "DTO_NOT_MINIMAL"
    : hasActiveLifecycleRow ? "ACTIVE_LIFECYCLE_ROW_EXISTS"
    : !allAcked ? "ACKS_INCOMPLETE"
    : isAuthorising ? "AUTHORISING_IN_PROGRESS"
    : null;

  const canAuthorise = blocker === null;

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
    // UI-level double-click / re-entry guard. Authoritative concurrency control
    // lives in the partial unique index `lifecycle_validation_one_active_per_account_idx`.
    if (busy) return;
    if (activeRow) { toast.error("An active lifecycle authorisation already exists."); return; }
    if (!canAuthorise) { toast.error(`Cannot authorise: ${blocker}`); return; }
    if (!window.confirm("Create new single-use lifecycle authorisation? No order is dispatched by this action.")) return;
    setBusy("arm");
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // UX-only pre-check (not authoritative; DB index is the real guard)
      const { data: existing } = await supabase
        .from("lifecycle_validation_authorisations" as any)
        .select("id,status")
        .eq("authorisation_type", "final_controlled_open_close_lifecycle_validation")
        .in("status", Array.from(ACTIVE_STATUSES));
      if (existing && existing.length > 0) {
        toast.error("Another active lifecycle row already exists — refusing to create a duplicate.");
        await load();
        return;
      }

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
          entry_outbound_dto: EXPECTED_DTO,
          acknowledgements: acks,
          preview_snapshot: preview,
        });

      if (error) {
        // PostgreSQL unique_violation — the partial unique index refused a
        // concurrent duplicate active authorisation.
        const code = (error as any)?.code;
        const isUniqueViolation =
          code === "23505" ||
          /duplicate key value/i.test(error.message ?? "") ||
          /lifecycle_validation_one_active_per_account_idx/i.test(error.message ?? "");
        if (isUniqueViolation) {
          toast.error(
            "ACTIVE_LIFECYCLE_AUTHORISATION_ALREADY_EXISTS: Another active lifecycle authorisation already exists for this MT5 account. Refresh before continuing.",
          );
          await load();
          return;
        }
        throw error;
      }

      toast.success("Lifecycle authorisation armed");
      setAcks({});
      setPreview(null);
      setPreviewAt(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Arm failed");
    } finally { setBusy(null); }
  };

  const executeEntry = async () => {
    if (!activeRow || activeRow.status !== "armed") return;
    if (!window.confirm("Dispatch ONE controlled EURUSD SELL 0.01 entry to Trading Layer? This is a real live order.")) return;
    setBusy("entry");
    try {
      const { data, error } = await supabase.functions.invoke("execute-lifecycle-entry", {
        body: { authorisationId: activeRow.id },
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
    if (!activeRow || activeRow.status !== "awaiting_position_confirmation") return;
    setBusy("confirm-position");
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const { data: positions } = await supabase
        .from("mt_positions").select("ticket, symbol, broker_symbol, side, volume, open_price, opened_at")
        .eq("user_id", uid!).or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD").eq("side", "sell");
      const match = (positions || []).find(
        (p: any) => Number(p.volume) === Number(activeRow.entry_volume),
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
        .eq("id", activeRow.id)
        .eq("status", "awaiting_position_confirmation");
      if (error) throw error;
      toast.success(`Position confirmed — ticket ${match.ticket}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Confirmation failed");
    } finally { setBusy(null); }
  };

  const executeClose = async () => {
    if (!activeRow || activeRow.status !== "position_confirmed_close_only" || !activeRow.confirmed_position_ticket) return;
    if (!window.confirm(`Dispatch controlled close for ticket ${activeRow.confirmed_position_ticket}? This is a real MT5 close.`)) return;
    setBusy("close");
    try {
      const { data, error } = await supabase.functions.invoke("execute-lifecycle-close", {
        body: { authorisationId: activeRow.id, ticket: activeRow.confirmed_position_ticket },
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
    if (!activeRow || activeRow.status !== "awaiting_close_confirmation") return;
    setBusy("confirm-close");
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const { count } = await supabase
        .from("mt_positions").select("id", { count: "exact", head: true })
        .eq("user_id", uid!).eq("ticket", activeRow.confirmed_position_ticket!);
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
        .eq("id", activeRow.id)
        .eq("status", "awaiting_close_confirmation");
      if (error) throw error;
      toast.success("Full lifecycle PASS recorded");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Close confirmation failed");
    } finally { setBusy(null); }
  };

  return (
    <Card className="p-4 border-primary/40 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Final Platform Lifecycle Validation — Entry + Controlled Close</h3>
        <StatusBadge status={activeRow ? activeRow.status : "not_authorised"} />
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
        Isolated single-use platform lifecycle test (entry + platform-controlled close). General client
        live execution and pending orders remain disabled. Historical attempts below are frozen evidence
        and never reused.
      </p>

      {/* HISTORICAL terminal rows — evidence only, never reused */}
      {historicalRows.length > 0 && (
        <Card className="p-3 mb-3 border-border/40 bg-muted/10">
          <div className="flex items-center gap-2 mb-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold">Previous Final Lifecycle Attempts — Historical Evidence (Non-Reusable)</h4>
          </div>
          <div className="space-y-3">
            {historicalRows.map((h) => {
              const isBlock = h.status === "review_required_pretrade_block";
              const isPass = h.status === "close_confirmed" || h.lifecycle_passed;
              return (
                <div key={h.id} className={`p-2 rounded border text-[11px] ${
                  isPass ? "border-emerald-500/40 bg-emerald-500/5"
                  : isBlock ? "border-red-500/50 bg-red-500/5"
                  : "border-border/40 bg-muted/10"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isPass ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                     : <AlertTriangle className="h-3 w-3 text-red-400" />}
                    <strong>
                      {isBlock ? "Previous Final Lifecycle Attempt — Blocked Before Broker Dispatch"
                       : isPass ? "Previous Final Lifecycle Attempt — Full Lifecycle PASS"
                       : `Previous Final Lifecycle Attempt — ${h.status}`}
                    </strong>
                    <StatusBadge status={h.status} />
                  </div>
                  <Row k="authorisation_id" v={<code className="text-[10px]">{h.id}</code>} />
                  <Row k="status" v={h.status} />
                  {isBlock && (
                    <>
                      <Row k="blocked_code" v={<span className="text-red-300">{h.entry_evidence?.blockedCode || h.failure_reason || "MAPPING_NOT_ACTIVE"}</span>} />
                      <Row k="brokerMutationDispatched" v={<span className="text-emerald-300">false</span>} />
                      <Row k="order_created" v="none" />
                      <Row k="entry_dispatches_consumed" v={h.entry_dispatches_consumed} />
                      <Row k="reusable" v={<span className="text-red-300">no</span>} />
                      <Row k="defect_status" v={<span className="text-emerald-300">resolved in current dispatcher version</span>} />
                    </>
                  )}
                  {isPass && (
                    <>
                      <Row k="entry_order_id" v={h.entry_order_id || "—"} />
                      <Row k="confirmed_position_ticket" v={h.confirmed_position_ticket || "—"} />
                      <Row k="close_order_id" v={h.close_order_id || "—"} />
                      <Row k="classification" v={h.classification || "—"} />
                    </>
                  )}
                  <Row k="classification" v={h.classification || "—"} />
                  <Row k="created_at" v={new Date(h.created_at).toLocaleString()} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ACTIVE row UI states */}
      {activeRow && activeRow.status === "armed" && (
        <div className="space-y-2">
          <div className="p-2 rounded border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-200">
            Authorisation armed. One entry dispatch permitted. Expires {new Date(activeRow.expires_at).toLocaleTimeString()}.
          </div>
          <Row k="authorisation_id" v={activeRow.id} />
          <Row k="entry_dto" v={<code>{JSON.stringify(activeRow.entry_outbound_dto)}</code>} />
          <Button size="sm" onClick={executeEntry} disabled={busy === "entry"}>
            {busy === "entry" ? "Dispatching…" : "Execute Final Lifecycle Entry — EURUSD SELL 0.01"}
          </Button>
        </div>
      )}

      {activeRow && activeRow.status === "awaiting_position_confirmation" && (
        <div className="space-y-2">
          <Row k="entry_order_id" v={activeRow.entry_order_id || "—"} />
          <Row k="entry_retcode" v={activeRow.entry_retcode ?? "—"} />
          <div className="p-2 rounded border border-border/40 text-[11px]">
            Entry dispatched. Reconcile EA / Trading Layer until the EURUSD SELL 0.01 position appears.
          </div>
          <Button size="sm" variant="outline" onClick={confirmPosition} disabled={busy === "confirm-position"}>
            <RefreshCw className="h-3 w-3 mr-1" /> Confirm Exact Position Ticket
          </Button>
        </div>
      )}

      {activeRow && activeRow.status === "position_confirmed_close_only" && (
        <div className="space-y-2">
          <Row k="confirmed_position_ticket" v={activeRow.confirmed_position_ticket || "—"} />
          <Row k="symbol" v="EURUSD" />
          <Row k="side" v="SELL" />
          <Row k="volume" v="0.01" />
          <div className="p-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-200">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            This is a real MT5 close action for the confirmed test position only.
          </div>
          <Button size="sm" onClick={executeClose} disabled={busy === "close"}>
            {busy === "close" ? "Closing…" : `Close Confirmed Test Position — Ticket ${activeRow.confirmed_position_ticket}`}
          </Button>
        </div>
      )}

      {activeRow && activeRow.status === "awaiting_close_confirmation" && (
        <div className="space-y-2">
          <Row k="close_order_id" v={activeRow.close_order_id || "—"} />
          <Row k="close_retcode" v={activeRow.close_retcode ?? "—"} />
          <div className="p-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-200">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            If platform close confirmation is uncertain, close ticket {activeRow.confirmed_position_ticket} manually in native MT5 immediately.
          </div>
          <Button size="sm" variant="outline" onClick={confirmCloseResolved} disabled={busy === "confirm-close"}>
            <RefreshCw className="h-3 w-3 mr-1" /> Confirm Close Reconciliation
          </Button>
        </div>
      )}

      {/* NEW authorisation form — only visible when NO active row exists */}
      {!activeRow && (
        <Card className="p-3 mt-3 border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-semibold">Create New Final Lifecycle Authorisation</h4>
          </div>

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

          <div className="flex flex-wrap gap-2 mb-3">
            <Button size="sm" variant="outline" onClick={runPreview} disabled={busy === "preview"}>
              {busy === "preview" ? "Validating…" : "Validate Final Lifecycle Entry Dispatcher — No Mutation"}
            </Button>
          </div>

          {preview && (
            <div className="mb-3 p-2 rounded border border-border/40 bg-muted/20">
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
              <Row k="mappingStatus" v={<span className={mappingValid ? "text-emerald-300" : "text-red-300"}>{preview.mappingStatus}</span>} />
              <Row k="route" v={<span className={routeExact ? "text-emerald-300" : "text-red-300"}>{preview.route || "—"}</span>} />
              <Row k="brokerSymbol" v={<span className={brokerExact ? "text-emerald-300" : "text-red-300"}>{preview.brokerSymbol || "—"}</span>} />
              <Row k="side / volume" v={`${preview.side} ${preview.volume}`} />
              <Row k="freshTick" v={`${preview.freshTick} (${preview.freshTickAgeMs ?? "—"}ms)`} />
              <Row k="openEurusdPositions" v={preview.openEurusdPositions ?? "—"} />
              <Row k="pendingEurusdOrders" v={preview.pendingEurusdOrders ?? "—"} />
              <Row k="outboundBody" v={<code className={dtoExact ? "text-emerald-300" : "text-red-300"}>{JSON.stringify(preview.outboundBody)}</code>} />
              <Row k="deviationAbsent" v={String(preview.deviationAbsent)} />
              <Row k="internalMetadataExcluded" v={String(preview.internalMetadataExcluded)} />
              {preview.blockedStage && (
                <Row k="blockedStage" v={<span className="text-red-300">{preview.blockedStage}: {preview.blockedCode}</span>} />
              )}
              <Row k="preview_fresh" v={previewFresh ? <span className="text-emerald-300">yes</span> : <span className="text-red-300">no (re-run)</span>} />
            </div>
          )}

          <div className="space-y-1.5 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Acknowledgements (all required)</div>
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

          <Button
            size="sm"
            onClick={arm}
            disabled={!canAuthorise}
            className="w-full"
          >
            <Lock className="h-3 w-3 mr-1" />
            {isAuthorising ? "Authorising…" : "Authorise Final Lifecycle Test"}
          </Button>
          <div className="mt-2 text-[10px] font-mono text-muted-foreground">
            canAuthorise={String(canAuthorise)} · blocker={blocker ?? "none"}
          </div>
          {!canAuthorise && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Authorise enables only when: fresh passing dispatcher preview, mappingStatus=valid,
              brokerSymbol=EURUSD, route={EXPECTED_ROUTE}, DTO={JSON.stringify(EXPECTED_DTO)},
              freshTick=pass, zero EURUSD exposure, no active lifecycle row, and every acknowledgement ticked.
            </div>
          )}
        </Card>
      )}

      <div className="mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" />
        general_client_live_execution = disabled · pending_orders_enabled = false · max_entry_dispatch = 1 · max_close_dispatch = 1 · active_row_uniqueness = enforced
      </div>
    </Card>
  );
};

export default AdminFinalLifecycleValidationCard;
