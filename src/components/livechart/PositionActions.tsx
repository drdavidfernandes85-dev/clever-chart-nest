import { useState, useEffect, useRef } from "react";
import { Loader2, X, Edit3, Scissors, AlertTriangle } from "lucide-react";
import { useLiveAccount } from "@/contexts/LiveAccountContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { LivePosition } from "@/contexts/LiveAccountContext";
import {
  checkAndHandle429,
  getCooldownRemainingMs,
  triggerRateLimitCooldown,
  isExecutionLocked,
  lockExecution,
  unlockExecution,
} from "@/lib/tradingLayerControl";
import { useExecutionLock } from "@/hooks/useExecutionLock";
import { useRiskSettings } from "@/hooks/useRiskSettings";
import { reconcileAfterClose } from "@/lib/positionReconciliation";
import { startAdminLiveTest, updateAdminLiveTest } from "@/lib/adminLiveTests";


const TEST_CLOSE_MAX_VOLUME = 0.01;

interface Props {
  position: LivePosition;
  onAfter: () => Promise<void> | void;
  cooling: boolean;
  cooldownSec: number;
  disabled?: boolean;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  };
}

function isRateLimited(status: number, data: any) {
  if (status === 429 || data?.retryAfter) {
    triggerRateLimitCooldown(Number(data?.retryAfter) > 0 ? Number(data.retryAfter) : 60);
    return true;
  }
  return false;
}

function safeStr(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return ""; }
}
function errMessageFrom(data: any) {
  const raw =
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.error?.message === "string" && data.error.message) ||
    (typeof data?.brokerMessage === "string" && data.brokerMessage) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error?.code === "string" && data.error.code) ||
    "Request failed";
  const rule = String(data?.rule || data?.ruleViolated || "").toLowerCase();
  // Friendlier, actionable rewrites for known backend rule failures.
  if (rule === "ticket_not_live" || /not found in live mt5/i.test(raw)) {
    return "Position not found on the live MT5 account. Refresh positions and try again.";
  }
  if (rule === "symbol_mismatch") return "Symbol mismatch between this row and the live MT5 position. Refresh positions and try again.";
  if (rule === "volume_exceeds_open") return "Close volume exceeds the open position volume. Refresh positions and try again.";
  if (rule === "side_mismatch") return "Side mismatch detected for this close. Refresh positions and try again.";
  if (rule === "kill_switch") return "Trading is disabled by the kill switch.";
  if (rule === "live_trading_disabled") return "Live trading is disabled in risk controls.";
  return raw;
}

function refreshPositionsNow() {
  window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
  window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
}

export default function PositionActions({ position, onAfter, cooling, cooldownSec, disabled }: Props) {
  const [openModify, setOpenModify] = useState(false);
  const [openPartial, setOpenPartial] = useState(false);
  const [openFull, setOpenFull] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { locked } = useExecutionLock();
  const { positions } = useLiveAccount();
  const positionsRef = useRef(positions);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  const { flags: riskFlags } = useRiskSettings();
  const riskBlock = riskFlags.killSwitch || !riskFlags.liveEnabled;
  const busy = submitting || cooling || disabled || locked || riskBlock;
  const ticket = position.ticket != null ? String(position.ticket) : null;


  async function refreshAll() {
    await onAfter();
    window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
    window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
    window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
  }

  function broadcastExec(status: string) {
    try { window.dispatchEvent(new CustomEvent("mt:exec-result", { detail: { status } })); }
    catch { /* ignore */ }
  }


  async function submitModify(stopLoss: number | null, takeProfit: number | null) {
    if (!ticket) return toast.error("Position identifier missing on this row. Refresh positions and try again.", { action: { label: "Refresh", onClick: refreshPositionsNow } });
    if (isExecutionLocked()) {
      return toast.warning("Another execution is in progress. Please wait.");
    }
    const prevSl = position.stop_loss;
    const prevTp = position.take_profit;
    // Record one row per requested protection (SL or TP). Both may be set.
    const slTestId = stopLoss !== null && stopLoss !== prevSl
      ? await startAdminLiveTest({
          testType: "modify_sl",
          positionTicket: ticket, brokerSymbol: position.symbol, side: position.side,
          notes: `prev_sl=${prevSl ?? "none"} -> requested_sl=${stopLoss}`,
        })
      : null;
    const tpTestId = takeProfit !== null && takeProfit !== prevTp
      ? await startAdminLiveTest({
          testType: "modify_tp",
          positionTicket: ticket, brokerSymbol: position.symbol, side: position.side,
          notes: `prev_tp=${prevTp ?? "none"} -> requested_tp=${takeProfit}`,
        })
      : null;
    setSubmitting(true);
    lockExecution("modify_sl_tp", 20000);
    const startedAt = Date.now();
    try {
      const headers = await authHeaders();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/modify-position-protection`;
      const r = await fetch(url, {
        method: "POST", cache: "no-store", headers,
        body: JSON.stringify({
          ticket, symbol: position.symbol, brokerSymbol: position.symbol, displaySymbol: position.symbol,
          side: position.side,
          volume: Number(position.volume), currentPrice: Number(position.current_price),
          stopLoss, takeProfit,
        }),
      });
      const data = await r.json().catch(() => ({}));
      const latencyMs = Date.now() - startedAt;
      if (isRateLimited(r.status, data)) {
        broadcastExec("Rate Limited");
        if (slTestId) await updateAdminLiveTest(slTestId, { status: "pending", confirmation_status: "confirmation_delayed_rate_limited", rate_limit_hit: true, latency_ms: latencyMs });
        if (tpTestId) await updateAdminLiveTest(tpTestId, { status: "pending", confirmation_status: "confirmation_delayed_rate_limited", rate_limit_hit: true, latency_ms: latencyMs });
        return;
      }
      checkAndHandle429(data, null);
      if (!r.ok || data?.success === false) {
        toast.error(errMessageFrom(data), { description: safeStr(data?.brokerMessage) });
        broadcastExec("SL/TP Failed");
        if (slTestId) await updateAdminLiveTest(slTestId, { status: "fail", confirmation_status: "modify_rejected", retcode: data?.retcode ?? null, latency_ms: latencyMs, evidence: data });
        if (tpTestId) await updateAdminLiveTest(tpTestId, { status: "fail", confirmation_status: "modify_rejected", retcode: data?.retcode ?? null, latency_ms: latencyMs, evidence: data });
      } else {
        toast.success("SL/TP updated successfully", { description: `#${ticket} ${position.symbol}` });
        broadcastExec("SL/TP Updated");
        setOpenModify(false);
        // Broker accepted. Verify against refreshed MT5 position state.
        await refreshAll();
        // Poll mt_positions briefly for the requested value to appear.
        const verify = async (kind: "sl" | "tp", requested: number) => {
          for (let i = 0; i < 6; i++) {
            await new Promise((res) => setTimeout(res, 1500));
            const { data: rows } = await supabase
              .from("mt_positions")
              .select("stop_loss,take_profit,updated_at")
              .eq("ticket", ticket).limit(1);
            const row0: any = (rows ?? [])[0];
            if (!row0) continue;
            const got = kind === "sl" ? Number(row0.stop_loss) : Number(row0.take_profit);
            if (Number.isFinite(got) && Math.abs(got - requested) < 1e-6) return true;
          }
          return false;
        };
        if (slTestId && stopLoss !== null) {
          const ok = await verify("sl", stopLoss);
          await updateAdminLiveTest(slTestId, {
            status: ok ? "pass" : "fail",
            confirmation_status: ok ? "sl_modification_confirmed" : "modify_unconfirmed_after_reconciliation",
            verified: ok, latency_ms: latencyMs, evidence: data,
          });
        }
        if (tpTestId && takeProfit !== null) {
          const ok = await verify("tp", takeProfit);
          await updateAdminLiveTest(tpTestId, {
            status: ok ? "pass" : "fail",
            confirmation_status: ok ? "tp_modification_confirmed" : "modify_unconfirmed_after_reconciliation",
            verified: ok, latency_ms: latencyMs, evidence: data,
          });
        }
        return;
      }
    } catch (e: any) {
      toast.error("Could not modify protection", { description: e?.message });
      broadcastExec("Modify Failed");
      if (slTestId) await updateAdminLiveTest(slTestId, { status: "fail", notes: e?.message });
      if (tpTestId) await updateAdminLiveTest(tpTestId, { status: "fail", notes: e?.message });
    } finally {
      setSubmitting(false);
      unlockExecution();
      await refreshAll();
    }
  }


  async function submitClose(volume: number, label: "partial" | "full") {
    if (!ticket) return toast.error("Position identifier missing. Refresh positions and try again.", { action: { label: "Refresh", onClick: refreshPositionsNow } });
    if (!position.symbol) return toast.error("Broker symbol missing on this position. Refresh positions and try again.", { action: { label: "Refresh", onClick: refreshPositionsNow } });
    if (!(position.side === "buy" || position.side === "sell")) return toast.error("Position side missing. Refresh positions and try again.");
    if (!(Number(volume) > 0)) return toast.error("Close volume must be greater than 0.");
    if (isExecutionLocked()) {
      return toast.warning("Another execution is in progress. Please wait.");
    }
    const openVolume = Number(position.volume);
    const clientCloseId = crypto.randomUUID();
    const clickClickAt = new Date().toISOString();
    setSubmitting(true);
    lockExecution(label === "full" ? "close_full" : "close_partial", 30000);
    let serverAccepted = false;
    let serverPartial = false;
    let closeAuditEventId: string | null = null;
    let serverResp: any = null;
    const adminCloseTestId = await startAdminLiveTest({
      testType: label === "full" ? "full_close" : "partial_close",
      positionTicket: ticket, brokerSymbol: position.symbol, side: position.side,
      requestedVolume: Number(volume), clientCloseId,
      notes: `${label} close ${volume} of ${openVolume}`,
    });

    try {
      const headers = await authHeaders();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/close-position-controlled`;
      const r = await fetch(url, {
        method: "POST", cache: "no-store", headers,
        body: JSON.stringify({
          closeId: clientCloseId,
          clientCloseId,
          requestId: clientCloseId,
          ticket: Number(ticket),
          positionTicket: Number(ticket),
          symbol: position.symbol,
          brokerSymbol: position.symbol,
          displaySymbol: position.symbol,
          openSide: position.side,
          openVolume,
          volume: Number(volume),
          partialVolume: label === "partial" ? Number(volume) : undefined,
          liveCloseConfirmed: true,
          clientClickAt: clickClickAt,
        }),
      });
      const data = await r.json().catch(() => ({}));
      serverResp = data;
      if (isRateLimited(r.status, data)) {
        broadcastExec("Rate Limited");
        if (adminCloseTestId) await updateAdminLiveTest(adminCloseTestId, {
          status: "pending", confirmation_status: "confirmation_delayed_rate_limited",
          rate_limit_hit: true, request_id: clientCloseId, evidence: data,
        });
        return;
      }
      checkAndHandle429(data, null);
      // Instant UI signal: close request was sent.
      toast.message("Close request sent", { description: `#${ticket} ${position.symbol}` });
      if (!r.ok || data?.success === false) {
        toast.error(errMessageFrom(data), {
          description: safeStr(data?.brokerMessage),
          action: { label: "Refresh", onClick: refreshPositionsNow },
        });
        broadcastExec("Close Rejected");
        if (adminCloseTestId) await updateAdminLiveTest(adminCloseTestId, {
          status: "fail", confirmation_status: "close_rejected",
          retcode: data?.retcode ?? null, retcode_name: data?.retcodeName ?? null,
          retcode_description: data?.retcodeDescription ?? null,
          request_id: clientCloseId, evidence: data,
        });
      } else if (data?.status === "closed" || data?.status === "partial_closed") {
        serverAccepted = true;
        serverPartial = data?.status === "partial_closed" || data?.partial === true;
        closeAuditEventId = typeof data?.auditEventId === "string" ? data.auditEventId : null;
        toast.success("Broker accepted close request", { description: "Waiting for MT5 confirmation." });
        if (label === "full") setOpenFull(false);
        else setOpenPartial(false);
        if (adminCloseTestId) await updateAdminLiveTest(adminCloseTestId, {
          status: "pending", confirmation_status: "close_broker_accepted_pending_confirmation",
          request_id: clientCloseId, order_id: data?.orderId ?? null,
          deal_id: data?.dealId ?? null, position_ticket: ticket,
          retcode: data?.retcode ?? null, retcode_name: data?.retcodeName ?? null,
          retcode_description: data?.retcodeDescription ?? null,
          latency_ms: data?.latencyMs ?? null, evidence: data,
        });
      } else {
        toast.warning(`Close ${safeStr(data?.status) || "pending"}`, {
          description: safeStr(data?.brokerMessage),
        });
        broadcastExec("Close Pending");
        if (adminCloseTestId) await updateAdminLiveTest(adminCloseTestId, {
          status: "pending", confirmation_status: safeStr(data?.status) || "close_pending",
          request_id: clientCloseId, evidence: data,
        });
      }

    } catch (e: any) {
      toast.error("Could not close position", { description: safeStr(e?.message) });
      broadcastExec("Close Failed");
    } finally {
      setSubmitting(false);
      unlockExecution();
      // Reconciliation IS the source of truth. Never trust server "closed" alone.
      try { await onAfter(); } catch { /* ignore */ }
      if (serverAccepted && ticket) {
        const getTickets = () =>
          (positionsRef.current ?? []).map((p) => (p.ticket == null ? "" : String(p.ticket)));
        const getVolumeForTicket = (t: string) => {
          const row = (positionsRef.current ?? []).find((p) => String(p.ticket) === t);
          return row ? Number(row.volume) : null;
        };
        const outcome = await reconcileAfterClose(
          onAfter,
          getTickets,
          ticket,
          { initialVolume: openVolume, getVolumeForTicket },
        );

        // Update / insert the audit row to reflect MT5 truth.
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const baseFields = {
              user_id: user.id,
              ticket,
              symbol: position.symbol,
              side: position.side,
              volume: Number(volume),
            };
            if (outcome === "closed") {
              const patch = {
                status: "closed",
                outcome: "closed",
                broker_message: "Position closed. Ticket removed from MT5 positions.",
                raw: { classification: "close_position", mt5Confirmed: true, reconciledAt: new Date().toISOString() },
              };
              if (closeAuditEventId) {
                await supabase.from("execution_audit_events").update(patch).eq("id", closeAuditEventId);
              } else {
                await supabase.from("execution_audit_events").insert({ ...baseFields, ...patch });
              }
            } else if (outcome === "partial") {
              const patch = {
                status: "partial_closed",
                outcome: "partial_closed",
                broker_message: "Position partially closed. Remaining volume confirmed in MT5.",
                raw: { classification: "close_position", mt5Confirmed: true, partial: true, reconciledAt: new Date().toISOString() },
              };
              if (closeAuditEventId) {
                await supabase.from("execution_audit_events").update(patch).eq("id", closeAuditEventId);
              } else {
                await supabase.from("execution_audit_events").insert({ ...baseFields, ...patch });
              }
            } else {
              const patch = {
                status: "close_unconfirmed",
                outcome: "close_unconfirmed",
                broker_message: "Close request accepted but ticket still exists in MT5 positions.",
                raw: { classification: "close_position", mt5Confirmed: false, reconciledAt: new Date().toISOString() },
              };
              if (closeAuditEventId) {
                await supabase.from("execution_audit_events").update(patch).eq("id", closeAuditEventId);
              } else {
                await supabase.from("execution_audit_events").insert({ ...baseFields, ...patch });
              }
            }
          }
        } catch { /* ignore audit failures */ }

        if (outcome === "closed") {
          toast.success("Position closed", { description: `#${ticket} ${position.symbol} — ticket removed from MT5.` });
          broadcastExec("Position Closed");
          if (adminCloseTestId) await updateAdminLiveTest(adminCloseTestId, {
            status: label === "full" ? "pass" : "pass",
            confirmation_status: "close_confirmed", verified: true,
            confirmed_volume: Number(volume),
          });
        } else if (outcome === "partial") {
          toast.success("Partial close completed", { description: `#${ticket} ${position.symbol}` });
          broadcastExec("Partial Closed");
          if (adminCloseTestId) await updateAdminLiveTest(adminCloseTestId, {
            status: label === "partial" ? "pass" : "fail",
            confirmation_status: "partial_close_confirmed", verified: label === "partial",
            confirmed_volume: Number(volume),
            notes: label === "full" ? "full close requested but only partial volume reduced" : null,
          });
        } else {
          toast.warning("Close request sent but position is still open in MT5.", {
            description: `#${ticket} ${position.symbol} — please verify in MetaTrader.`,
          });
          broadcastExec("Close Unconfirmed");
          if (adminCloseTestId) await updateAdminLiveTest(adminCloseTestId, {
            status: "fail", confirmation_status: "close_unconfirmed_after_reconciliation",
          });
        }


        // Emit close debug event for Dev Mode diagnostics panel.
        try {
          const positionsAfter = (positionsRef.current ?? []).map((p) => ({ ...p }));
          const remaining = (positionsRef.current ?? []).find((p) => String(p.ticket) === String(ticket));
          window.dispatchEvent(new CustomEvent("mt:execution-reconcile-debug", {
            detail: {
              at: new Date().toISOString(),
              kind: label === "partial" ? "partial_close" : "close",
              account: {
                metaapi_account_id: serverResp?.metaapi_account_id ?? null,
                accountIdUsed: serverResp?.metaapi_account_id ?? null,
              },
              ids: {
                clientCloseId,
                requestId: serverResp?.requestId ?? clientCloseId,
                orderId: serverResp?.orderId ?? null,
                dealId: serverResp?.dealId ?? null,
                positionTicket: serverResp?.positionTicket ?? ticket,
                brokerSymbol: serverResp?.brokerSymbol ?? position.symbol,
                displaySymbol: position.symbol,
              },
              request: {
                symbol: position.symbol,
                side: position.side,
                volume: Number(volume),
                endpoint: "close-position-controlled",
                originalVolume: openVolume,
                closeVolume: Number(volume),
                remainingVolumeExpected: Math.max(0, openVolume - Number(volume)),
              },
              response: {
                retcode: serverResp?.retcode ?? null,
                retcodeName: serverResp?.retcodeName ?? null,
                retcodeDescription: serverResp?.retcodeDescription ?? null,
                classification: serverResp?.classification ?? null,
                brokerAccepted: serverAccepted,
                mt5Confirmed: outcome === "closed" || outcome === "partial",
                confirmationStatus:
                  outcome === "closed" ? "close_confirmed"
                  : outcome === "partial" ? "partial_close_confirmed"
                  : "close_unconfirmed_after_reconciliation",
                status: serverResp?.status ?? null,
                raw: serverResp ?? null,
              },
              reconciliation: {
                positionsBefore: [],
                positionsAfter,
                matchFound: outcome === "closed" || outcome === "partial",
                confirmedTicket: ticket,
                attempts: null,
                lastAttemptAt: new Date().toISOString(),
                sourcesChecked: { positions: true, orders: null, deals: null },
                matchingMode: "positionTicket",
                matchedTicket: outcome === "closed" ? ticket : (remaining ? ticket : null),
                matchedDealId: serverResp?.dealId ?? null,
                matchedOrderId: serverResp?.orderId ?? null,
              },
              durations: { backendTotalMs: serverResp?.latencyMs ?? null },
            },
          }));
        } catch { /* ignore */ }
      }

      window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
      window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
      window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
    }
  }




  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          title="Modify SL / TP"
          disabled={busy}
          onClick={() => setOpenModify(true)}
          className="inline-flex h-5 items-center gap-1 rounded border border-neutral-800 bg-[#0a0a0a] px-1.5 text-[9px] font-bold uppercase tracking-widest text-neutral-300 hover:border-[#FFCD05]/50 hover:text-[#FFCD05] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Edit3 className="h-3 w-3" />
          SL/TP
        </button>
        <button
          type="button"
          title={Number(position.volume) <= TEST_CLOSE_MAX_VOLUME
            ? `Partial close requires a position larger than the current ${TEST_CLOSE_MAX_VOLUME.toFixed(2)} lot admin-test limit.`
            : "Partial Close"}
          disabled={busy || Number(position.volume) <= TEST_CLOSE_MAX_VOLUME}
          onClick={() => setOpenPartial(true)}
          className="inline-flex h-5 items-center gap-1 rounded border border-neutral-800 bg-[#0a0a0a] px-1.5 text-[9px] font-bold uppercase tracking-widest text-neutral-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Scissors className="h-3 w-3" />
          Partial
        </button>

        <button
          type="button"
          title={cooling ? `Rate limited (${cooldownSec}s)` : "Close Full Position"}
          disabled={busy}
          onClick={() => setOpenFull(true)}
          className="inline-flex h-5 items-center gap-1 rounded border border-neutral-800 bg-[#0a0a0a] px-1.5 text-[9px] font-bold uppercase tracking-widest text-neutral-300 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          {cooling ? `${cooldownSec}s` : "Close"}
        </button>
      </div>

      <ModifyDialog
        open={openModify}
        onOpenChange={setOpenModify}
        position={position}
        submitting={submitting}
        onSubmit={submitModify}
      />
      <PartialDialog
        open={openPartial}
        onOpenChange={setOpenPartial}
        position={position}
        submitting={submitting}
        onSubmit={(v) => submitClose(v, "partial")}
      />
      <FullCloseDialog
        open={openFull}
        onOpenChange={setOpenFull}
        position={position}
        submitting={submitting}
        onSubmit={() => submitClose(Number(position.volume), "full")}
      />
    </>
  );
}

/* ---------- Modify SL/TP dialog ---------- */
function ModifyDialog({
  open, onOpenChange, position, submitting, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: LivePosition;
  submitting: boolean;
  onSubmit: (sl: number | null, tp: number | null) => void;
}) {
  const [sl, setSl] = useState<string>(position.stop_loss != null ? String(position.stop_loss) : "");
  const [tp, setTp] = useState<string>(position.take_profit != null ? String(position.take_profit) : "");

  useEffect(() => {
    if (open) {
      setSl(position.stop_loss != null ? String(position.stop_loss) : "");
      setTp(position.take_profit != null ? String(position.take_profit) : "");
    }
  }, [open, position.stop_loss, position.take_profit]);

  const current = Number(position.current_price);
  const isBuy = position.side === "buy";

  const slNum = sl.trim() === "" ? null : Number(sl);
  const tpNum = tp.trim() === "" ? null : Number(tp);

  let error: string | null = null;
  if (slNum !== null && !Number.isFinite(slNum)) error = "SL must be a number";
  else if (tpNum !== null && !Number.isFinite(tpNum)) error = "TP must be a number";
  else if (slNum === null && tpNum === null) error = "Enter SL or TP";
  else if (Number.isFinite(current) && current > 0) {
    if (isBuy) {
      if (slNum !== null && slNum >= current) error = "Buy: SL must be below current price";
      else if (tpNum !== null && tpNum <= current) error = "Buy: TP must be above current price";
    } else {
      if (slNum !== null && slNum <= current) error = "Sell: SL must be above current price";
      else if (tpNum !== null && tpNum >= current) error = "Sell: TP must be below current price";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modify SL / TP</DialogTitle>
          <DialogDescription>
            Adjust stop loss and take profit for this open position.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-2 rounded border border-neutral-800 bg-[#0a0a0a] p-2">
            <div><span className="text-neutral-500">Ticket</span><div className="text-neutral-100">#{String(position.ticket ?? "—")}</div></div>
            <div><span className="text-neutral-500">Symbol</span><div className="text-neutral-100">{position.symbol}</div></div>
            <div><span className="text-neutral-500">Side</span><div className={isBuy ? "text-emerald-400" : "text-red-400"}>{position.side.toUpperCase()}</div></div>
            <div><span className="text-neutral-500">Volume</span><div className="text-neutral-100">{Number(position.volume).toFixed(2)}</div></div>
            <div className="col-span-2"><span className="text-neutral-500">Current price</span><div className="text-neutral-100">{Number.isFinite(current) ? current : "—"}</div></div>
          </div>
          <div className="space-y-2">
            <div>
              <Label htmlFor="sl" className="text-[10px] uppercase tracking-widest text-neutral-400">Stop Loss</Label>
              <Input id="sl" inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Leave empty to keep / clear" />
            </div>
            <div>
              <Label htmlFor="tp" className="text-[10px] uppercase tracking-widest text-neutral-400">Take Profit</Label>
              <Input id="tp" inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Leave empty to keep / clear" />
            </div>
          </div>
          {error && <div className="text-[11px] text-red-400">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            disabled={!!error || submitting}
            onClick={() => onSubmit(slNum, tpNum)}
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Partial Close dialog ---------- */
function PartialDialog({
  open, onOpenChange, position, submitting, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: LivePosition;
  submitting: boolean;
  onSubmit: (volume: number) => void;
}) {
  const maxByPosition = Number(position.volume) || 0;
  const cap = Math.min(maxByPosition, TEST_CLOSE_MAX_VOLUME);
  const [vol, setVol] = useState<string>(cap > 0 ? cap.toFixed(2) : "");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setVol(cap > 0 ? cap.toFixed(2) : "");
      setConfirmed(false);
    }
  }, [open, cap]);

  const volNum = Number(vol);
  let error: string | null = null;
  if (!Number.isFinite(volNum) || volNum <= 0) error = "Enter a volume greater than 0";
  else if (volNum > maxByPosition) error = `Cannot exceed position volume (${maxByPosition.toFixed(2)})`;
  else if (volNum > TEST_CLOSE_MAX_VOLUME) error = `Testing cap: max ${TEST_CLOSE_MAX_VOLUME.toFixed(2)} lots`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Partial Close</DialogTitle>
          <DialogDescription>
            Close part of this open position. Testing cap is {TEST_CLOSE_MAX_VOLUME.toFixed(2)} lots.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-2 rounded border border-neutral-800 bg-[#0a0a0a] p-2">
            <div><span className="text-neutral-500">Ticket</span><div className="text-neutral-100">#{String(position.ticket ?? "—")}</div></div>
            <div><span className="text-neutral-500">Symbol</span><div className="text-neutral-100">{position.symbol}</div></div>
            <div><span className="text-neutral-500">Side</span><div>{position.side.toUpperCase()}</div></div>
            <div><span className="text-neutral-500">Open volume</span><div className="text-neutral-100">{maxByPosition.toFixed(2)}</div></div>
          </div>
          <div>
            <Label htmlFor="pvol" className="text-[10px] uppercase tracking-widest text-neutral-400">Volume to close</Label>
            <Input id="pvol" inputMode="decimal" value={vol} onChange={(e) => setVol(e.target.value)} />
          </div>
          {error && <div className="text-[11px] text-red-400">{error}</div>}
          <label className="flex items-start gap-2 rounded border border-red-500/40 bg-red-950/20 p-2 text-[11px] text-red-200">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
            <span>I understand this closes a live MT5 position.</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            disabled={!!error || !confirmed || submitting}
            onClick={() => onSubmit(volNum)}
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
            Close {Number.isFinite(volNum) ? volNum.toFixed(2) : "—"} lots
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Full Close dialog ---------- */
function FullCloseDialog({
  open, onOpenChange, position, submitting, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: LivePosition;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (open) setConfirmed(false); }, [open]);
  const volume = Number(position.volume) || 0;
  const overCap = volume > TEST_CLOSE_MAX_VOLUME;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Close Full Position
          </DialogTitle>
          <DialogDescription>
            This will close the entire MT5 position via the controlled close path.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-2 rounded border border-neutral-800 bg-[#0a0a0a] p-2">
            <div><span className="text-neutral-500">Ticket</span><div className="text-neutral-100">#{String(position.ticket ?? "—")}</div></div>
            <div><span className="text-neutral-500">Symbol</span><div className="text-neutral-100">{position.symbol}</div></div>
            <div><span className="text-neutral-500">Side</span><div>{position.side.toUpperCase()}</div></div>
            <div><span className="text-neutral-500">Volume</span><div className="text-neutral-100">{volume.toFixed(2)}</div></div>
          </div>
          {overCap && (
            <div className="rounded border border-red-500/50 bg-red-950/30 p-2 text-[11px] text-red-300">
              Volume {volume.toFixed(2)} exceeds the {TEST_CLOSE_MAX_VOLUME.toFixed(2)} testing cap. Use Partial Close.
            </div>
          )}
          <label className="flex items-start gap-2 rounded border border-red-500/40 bg-red-950/20 p-2 text-[11px] text-red-200">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
            <span>I understand this closes a live MT5 position.</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!confirmed || submitting || overCap}
            onClick={onSubmit}
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
            Close Position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
