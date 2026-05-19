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
import { reconcileAfterClose, notifyCloseResult } from "@/lib/positionReconciliation";

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
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.brokerMessage === "string") return data.brokerMessage;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error?.code === "string") return data.error.code;
  return "Request failed";
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

  const busy = submitting || cooling || disabled || locked;
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
    if (!ticket) return toast.error("Missing ticket.");
    if (isExecutionLocked()) {
      return toast.warning("Another execution is in progress. Please wait.");
    }
    setSubmitting(true);
    lockExecution("modify_sl_tp", 20000);
    try {
      const headers = await authHeaders();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/modify-position-protection`;
      const r = await fetch(url, {
        method: "POST", cache: "no-store", headers,
        body: JSON.stringify({
          ticket, symbol: position.symbol, side: position.side,
          volume: Number(position.volume), currentPrice: Number(position.current_price),
          stopLoss, takeProfit,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (isRateLimited(r.status, data)) { broadcastExec("Rate Limited"); return; }
      checkAndHandle429(data, null);
      if (!r.ok || data?.success === false) {
        toast.error(errMessageFrom(data), { description: String(data?.brokerMessage ?? "") });
        broadcastExec("Modify Failed");
      } else {
        toast.success("Protection updated", { description: `#${ticket} ${position.symbol}` });
        broadcastExec("Protection Updated");
        setOpenModify(false);
      }
    } catch (e: any) {
      toast.error("Could not modify protection", { description: e?.message });
      broadcastExec("Modify Failed");
    } finally {
      setSubmitting(false);
      unlockExecution();
      await refreshAll();
    }
  }

  async function submitClose(volume: number, label: "partial" | "full") {
    if (!ticket) return toast.error("Missing ticket.");
    if (isExecutionLocked()) {
      return toast.warning("Another execution is in progress. Please wait.");
    }
    setSubmitting(true);
    lockExecution(label === "full" ? "close_full" : "close_partial", 30000);
    let serverClosed = false;
    try {
      const headers = await authHeaders();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/close-position-controlled`;
      const r = await fetch(url, {
        method: "POST", cache: "no-store", headers,
        body: JSON.stringify({
          ticket, symbol: position.symbol, volume,
          side: position.side === "buy" ? "sell" : "buy",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (isRateLimited(r.status, data)) { broadcastExec("Rate Limited"); return; }
      checkAndHandle429(data, null);
      if (!r.ok || data?.success === false) {
        toast.error(errMessageFrom(data), { description: String(data?.brokerMessage ?? "") });
        broadcastExec("Close Rejected");
      } else if (data?.status === "closed") {
        serverClosed = true;
        if (label === "full") setOpenFull(false);
        else setOpenPartial(false);
      } else {
        toast.warning(`Close ${data?.status || "pending"}`, {
          description: String(data?.brokerMessage ?? ""),
        });
        broadcastExec("Close Pending");
      }
    } catch (e: any) {
      toast.error("Could not close position", { description: e?.message });
      broadcastExec("Close Failed");
    } finally {
      setSubmitting(false);
      unlockExecution();
      // Reconcile: refresh now + at 1.5s + 3s; check ticket disappears.
      try { await onAfter(); } catch { /* ignore */ }
      if (serverClosed && ticket) {
        const getTickets = () =>
          (positionsRef.current ?? []).map((p) => (p.ticket == null ? "" : String(p.ticket)));
        const outcome = await reconcileAfterClose(onAfter, getTickets, ticket);
        notifyCloseResult(outcome, position.symbol, ticket);
        broadcastExec(outcome === "closed" ? "Position Closed" : "Close Pending");
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
          title="Partial Close"
          disabled={busy}
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
