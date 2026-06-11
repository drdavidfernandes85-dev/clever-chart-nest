/**
 * Phase 5(b) — Position & pending-order action dialogs.
 *
 * Exposes:
 *   - ModifyProtectionDialog → modify-position-protection edge function.
 *     Reuses the OrderTicket 4-mode SL/TP block (price | pips | $ | %),
 *     side-aware validation, side-correct tickValue projection.
 *   - CloseConfirmDialog → close-position-controlled (full close).
 *   - PartialCloseDialog → close-position-controlled (validates against the
 *     symbol volumeStep/volumeMin and live volume; shows remainder).
 *   - CancelOrderConfirmDialog → cancel-pending-order. Implements the
 *     cancel_broker_accepted_pending_confirmation contract: caller drives the
 *     row through "Cancelando…", then re-polls 2–3 times to confirm the
 *     order disappears. If it persists, the row surfaces "no confirmado".
 *   - BulkCloseDialog → iterates close-position-controlled per ticket
 *     client-side and reports per-position outcome in Spanish.
 *
 * All actions ALWAYS confirm — one-click is market-entry-only and does not
 * extend to position/order management actions.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSymbolSpec, type SymbolSpec } from "@/hooks/useSymbolSpec";
import { translateBrokerRejection } from "@/lib/brokerRejectionEs";

/* ─────────── shared types ─────────── */

export interface LivePosition {
  ticket: number | string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entry_price: number;
  current_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  net_profit: number;
  profit: number;
}

export interface PendingOrderLite {
  ticket: number | string;
  symbol: string;
  orderType: string;
  side: "buy" | "sell";
  volume: number;
  price_open: number;
}

/* ─────────── helpers (mirror OrderTicket math, side-aware) ─────────── */

function pipSizeFor(digits: number | null | undefined): number {
  const d = digits ?? 5;
  if (d >= 5) return 0.0001;
  if (d >= 3) return 0.01;
  return 1;
}
function pipValuePerLotFor(spec: SymbolSpec | null, side: "profit" | "loss"): number | null {
  if (!spec || spec.tickSize == null || spec.tickSize === 0) return null;
  const tv = side === "profit" ? (spec.tickValueProfit ?? spec.tickValue)
                               : (spec.tickValueLoss ?? spec.tickValue);
  if (tv == null) return null;
  return (tv / spec.tickSize) * pipSizeFor(spec.digits);
}
function fmtPrice(sym: string, v: number | null | undefined, digits?: number) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const d = digits ?? (sym.toUpperCase().includes("JPY") ? 3 : 5);
  return Number(v).toFixed(d);
}
function fmtMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(2)}`;
}
function roundToStep(v: number, step: number): number {
  const k = Math.round(v / step);
  return Number((k * step).toFixed(8));
}

type SLMode = "price" | "pips" | "amount" | "pct";
interface SLState { mode: SLMode; input: string }
const MODE_LABEL: Record<SLMode, string> = {
  price: "Precio", pips: "Pips", amount: "Proyectado", pct: "% balance",
};

function resolveProtection(opts: {
  state: SLState; side: "buy" | "sell"; isStopLoss: boolean;
  reference: number; volume: number; pipSize: number;
  pipValuePerLot: number | null; balance: number | null;
}) {
  const { state, side, isStopLoss, reference, volume, pipSize, pipValuePerLot, balance } = opts;
  const raw = state.input.trim();
  if (!raw) return { price: null as number | null, pips: null as number | null, amount: null as number | null, pct: null as number | null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { price: null, pips: null, amount: null, pct: null };
  const sign = isStopLoss ? (side === "buy" ? -1 : +1) : (side === "buy" ? +1 : -1);
  let pips: number | null = null;
  let price: number | null = null;
  if (state.mode === "price") {
    price = n;
    pips = (price - reference) / pipSize * (sign > 0 ? 1 : -1);
  } else if (state.mode === "pips") {
    pips = n; price = reference + sign * n * pipSize;
  } else if (state.mode === "amount" && pipValuePerLot && volume > 0) {
    pips = n / (pipValuePerLot * volume);
    price = reference + sign * pips * pipSize;
  } else if (state.mode === "pct" && balance && pipValuePerLot && volume > 0) {
    const amount = balance * (n / 100);
    pips = amount / (pipValuePerLot * volume);
    price = reference + sign * pips * pipSize;
  }
  const amount = pips != null && pipValuePerLot != null ? pips * pipValuePerLot * volume : null;
  const pct = amount != null && balance ? (amount / balance) * 100 : null;
  return { price, pips, amount, pct };
}

/* ─────────── ModifyProtectionDialog ─────────── */

export function ModifyProtectionDialog({
  open, onOpenChange, position, accountBalance, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: LivePosition | null;
  accountBalance: number | null;
  onDone: () => void;
}) {
  const { spec } = useSymbolSpec(position?.symbol ?? null);
  const digits = spec?.digits ?? (position?.symbol?.toUpperCase().includes("JPY") ? 3 : 5);
  const pipSize = pipSizeFor(digits);
  const pvProfit = pipValuePerLotFor(spec, "profit");
  const pvLoss = pipValuePerLotFor(spec, "loss");

  const [sl, setSl] = useState<SLState>({ mode: "price", input: "" });
  const [tp, setTp] = useState<SLState>({ mode: "price", input: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && position) {
      setSl({ mode: "price", input: position.stop_loss != null ? String(position.stop_loss) : "" });
      setTp({ mode: "price", input: position.take_profit != null ? String(position.take_profit) : "" });
    }
  }, [open, position?.ticket]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!position) return null;
  const ref = position.entry_price;

  const slRes = resolveProtection({
    state: sl, side: position.side, isStopLoss: true, reference: ref,
    volume: position.volume, pipSize, pipValuePerLot: pvLoss, balance: accountBalance,
  });
  const tpRes = resolveProtection({
    state: tp, side: position.side, isStopLoss: false, reference: ref,
    volume: position.volume, pipSize, pipValuePerLot: pvProfit, balance: accountBalance,
  });

  // Side-aware validation against the live current price.
  const cur = position.current_price;
  let validationError: string | null = null;
  if (slRes.price != null && Number.isFinite(cur) && cur > 0) {
    if (position.side === "buy" && slRes.price >= cur) validationError = "Para compra, el SL debe estar por debajo del precio actual.";
    if (position.side === "sell" && slRes.price <= cur) validationError = "Para venta, el SL debe estar por encima del precio actual.";
  }
  if (!validationError && tpRes.price != null && Number.isFinite(cur) && cur > 0) {
    if (position.side === "buy" && tpRes.price <= cur) validationError = "Para compra, el TP debe estar por encima del precio actual.";
    if (position.side === "sell" && tpRes.price >= cur) validationError = "Para venta, el TP debe estar por debajo del precio actual.";
  }

  const submit = async () => {
    if (submitting) return;
    if (slRes.price == null && tpRes.price == null) {
      toast.error("Indica al menos SL o TP.");
      return;
    }
    if (validationError) { toast.error(validationError); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("modify-position-protection", {
        body: {
          ticket: position.ticket, symbol: position.symbol, side: position.side,
          volume: position.volume, currentPrice: cur,
          stopLoss: slRes.price, takeProfit: tpRes.price,
        },
      });
      if (error) { toast.error(translateBrokerRejection({ error: error.message })); return; }
      if (data?.success !== true) {
        toast.error(translateBrokerRejection({
          retcode: data?.retcode, retcodeName: data?.retcodeName,
          retcodeDescription: data?.retcodeDescription, brokerMessage: data?.brokerMessage,
          error: data?.error, status: data?.status, reason: data?.reason,
        }));
        return;
      }
      toast.success(`SL/TP actualizados en ${position.symbol} (#${position.ticket})`);
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(translateBrokerRejection({ error: e?.message || "Network error" }));
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-md bg-[#0c0c0c] border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Modificar SL / TP — {position.symbol} #{position.ticket}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {position.side === "buy" ? "Compra" : "Venta"} {position.volume.toFixed(2)} lotes ·
            Entrada {fmtPrice(position.symbol, ref, digits)} · Actual {fmtPrice(position.symbol, cur, digits)}
          </DialogDescription>
        </DialogHeader>

        <ProtectionRow
          label="Stop Loss" state={sl} setState={setSl}
          resolution={slRes} digits={digits} symbol={position.symbol}
        />
        <ProtectionRow
          label="Take Profit" state={tp} setState={setTp}
          resolution={tpRes} digits={digits} symbol={position.symbol}
        />

        {validationError && (
          <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {validationError}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting || !!validationError}
            className="bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90">
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Aplicar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProtectionRow({
  label, state, setState, resolution, digits, symbol,
}: {
  label: string; state: SLState; setState: (s: SLState) => void;
  resolution: { price: number | null; pips: number | null; amount: number | null; pct: number | null };
  digits: number; symbol: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-400">
        <span>{label}</span>
        <div className="flex gap-0.5">
          {(["price", "pips", "amount", "pct"] as SLMode[]).map((m) => (
            <button key={m} type="button"
              onClick={() => setState({ ...state, mode: m })}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px]",
                state.mode === m ? "bg-[#FFCD05]/15 text-[#FFCD05]" : "text-neutral-500 hover:text-neutral-300",
              )}>{MODE_LABEL[m]}</button>
          ))}
        </div>
      </div>
      <Input value={state.input} onChange={(e) => setState({ ...state, input: e.target.value })}
        placeholder={state.mode === "price" ? "0.00000" : state.mode === "pips" ? "pips" : state.mode === "amount" ? "USD" : "%"}
        className="h-8 text-xs font-mono" inputMode="decimal" />
      <div className="text-[10px] text-neutral-500 font-mono">
        → Precio {fmtPrice(symbol, resolution.price, digits)} ·
        Pips {resolution.pips != null ? resolution.pips.toFixed(1) : "—"} ·
        Proyectado {fmtMoney(resolution.amount)} ·
        {resolution.pct != null ? ` ${resolution.pct.toFixed(2)}%` : " —"}
      </div>
    </div>
  );
}

/* ─────────── CloseConfirmDialog (full close) ─────────── */

export function CloseConfirmDialog({
  open, onOpenChange, position, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: LivePosition | null;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  if (!position) return null;
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("close-position-controlled", {
        body: {
          ticket: position.ticket, symbol: position.symbol,
          volume: position.volume, openSide: position.side,
          openVolume: position.volume, liveCloseConfirmed: true,
          closeId: `close-${position.ticket}-${Date.now()}`,
          clientClickAt: new Date().toISOString(),
        },
      });
      if (error) { toast.error(translateBrokerRejection({ error: error.message })); return; }
      if (data?.success !== true) {
        toast.error(translateBrokerRejection({
          retcode: data?.retcode, retcodeName: data?.retcodeName,
          brokerMessage: data?.brokerMessage, error: data?.error,
          status: data?.status, reason: data?.reason,
        }));
        return;
      }
      toast.success(`Posición cerrada: ${position.symbol} #${position.ticket}`);
      onOpenChange(false); onDone();
    } catch (e: any) {
      toast.error(translateBrokerRejection({ error: e?.message || "Network error" }));
    } finally { setSubmitting(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <AlertDialogContent className="bg-[#0c0c0c] border-neutral-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">Cerrar posición</AlertDialogTitle>
          <AlertDialogDescription className="text-xs space-y-1">
            <div className="font-mono">
              {position.symbol} · {position.side === "buy" ? "Compra" : "Venta"} {position.volume.toFixed(2)} lotes
            </div>
            <div className={cn("font-mono", position.net_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
              P&L neto en vivo: {fmtMoney(position.net_profit)}
            </div>
            <div>Esta acción cierra la posición completa al precio de mercado actual.</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); submit(); }} disabled={submitting}
            className="bg-red-500 text-white hover:bg-red-600">
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Cerrar posición
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─────────── PartialCloseDialog ─────────── */

export function PartialCloseDialog({
  open, onOpenChange, position, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: LivePosition | null;
  onDone: () => void;
}) {
  const { spec } = useSymbolSpec(position?.symbol ?? null);
  const step = spec?.volumeStep ?? 0.01;
  const min = spec?.volumeMin ?? 0.01;
  const [volStr, setVolStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && position) {
      const half = roundToStep(position.volume / 2, step);
      const initial = Math.max(min, Math.min(half, position.volume - min));
      setVolStr(initial > 0 ? initial.toFixed(2) : min.toFixed(2));
    }
  }, [open, position?.ticket, step, min]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!position) return null;

  const requested = Number(volStr);
  const valid = Number.isFinite(requested) && requested > 0;
  const snapped = valid ? roundToStep(requested, step) : 0;
  const stepAligned = valid && Math.abs(snapped - requested) < 1e-8;
  const remainder = valid ? Number((position.volume - requested).toFixed(8)) : 0;
  let validationError: string | null = null;
  if (!valid) validationError = "Volumen inválido.";
  else if (requested < min) validationError = `Mínimo ${min}.`;
  else if (!stepAligned) validationError = `Volumen debe alinearse al paso ${step} (sugerido ${snapped.toFixed(2)}).`;
  else if (requested > position.volume) validationError = `Excede el volumen abierto (${position.volume.toFixed(2)}).`;
  else if (remainder > 0 && remainder < min) validationError = `Restante (${remainder.toFixed(2)}) sería menor al mínimo ${min}. Usa cierre completo.`;

  const submit = async () => {
    if (submitting || validationError) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("close-position-controlled", {
        body: {
          ticket: position.ticket, symbol: position.symbol,
          volume: requested, openSide: position.side,
          openVolume: position.volume, liveCloseConfirmed: true,
          closeId: `close-${position.ticket}-${Date.now()}`,
          clientClickAt: new Date().toISOString(),
        },
      });
      if (error) { toast.error(translateBrokerRejection({ error: error.message })); return; }
      if (data?.success !== true) {
        toast.error(translateBrokerRejection({
          retcode: data?.retcode, retcodeName: data?.retcodeName,
          brokerMessage: data?.brokerMessage, error: data?.error,
          status: data?.status, reason: data?.reason,
        }));
        return;
      }
      toast.success(`Cierre parcial enviado (${requested.toFixed(2)} de ${position.volume.toFixed(2)})`);
      onOpenChange(false); onDone();
    } catch (e: any) {
      toast.error(translateBrokerRejection({ error: e?.message || "Network error" }));
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md bg-[#0c0c0c] border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Cierre parcial — {position.symbol} #{position.ticket}
          </DialogTitle>
          <DialogDescription className="text-xs font-mono">
            {position.side === "buy" ? "Compra" : "Venta"} {position.volume.toFixed(2)} lotes ·
            Paso {step} · Mínimo {min}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-neutral-400">Volumen a cerrar</label>
            <Input value={volStr} onChange={(e) => setVolStr(e.target.value)} inputMode="decimal"
              className="h-8 text-xs font-mono mt-1" />
          </div>
          <div className="text-[11px] font-mono text-neutral-400">
            Restante después del cierre: <span className="text-neutral-100">{remainder >= 0 ? remainder.toFixed(2) : "—"}</span> lotes
          </div>
          {validationError && (
            <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {validationError}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit}
            disabled={submitting || !!validationError}
            className="bg-red-500 text-white hover:bg-red-600">
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Cerrar {requested > 0 ? requested.toFixed(2) : "—"} lotes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── CancelOrderConfirmDialog (with re-poll contract) ─────────── */

export function CancelOrderConfirmDialog({
  open, onOpenChange, order, onCancelling, onConfirmed, onUnconfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: PendingOrderLite | null;
  /** Called right after broker-accepted reply; parent marks the row "Cancelando…". */
  onCancelling: (ticket: string) => void;
  /** Called when the row disappears from a subsequent poll. */
  onConfirmed: (ticket: string) => void;
  /** Called when the row persists past the re-poll budget. */
  onUnconfirmed: (ticket: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  if (!order) return null;
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-pending-order", {
        body: { orderId: order.ticket, symbol: order.symbol },
      });
      if (error) { toast.error(translateBrokerRejection({ error: error.message })); return; }
      const accepted = data?.status === "cancel_broker_accepted_pending_confirmation"
                    || data?.success === true;
      if (!accepted) {
        toast.error(translateBrokerRejection({
          retcode: data?.retcode, brokerMessage: data?.brokerMessage,
          error: data?.error, status: data?.status, reason: data?.reason,
        }));
        return;
      }
      const ticketStr = String(order.ticket);
      onCancelling(ticketStr);
      toast.info("Cancelación aceptada por el bróker. Confirmando…");
      onOpenChange(false);

      // Re-poll contract: confirm disappearance within ~3 broker snapshots.
      const POLL_INTERVAL = 1800;
      const MAX_POLLS = 3;
      let polls = 0;
      const tick = async () => {
        polls++;
        try {
          const { data: snap } = await supabase.functions.invoke("get-mt5-terminal-data", { body: {} });
          const stillThere = Array.isArray(snap?.pendingOrders)
            && snap.pendingOrders.some((o: any) => String(o.ticket) === ticketStr);
          if (!stillThere) {
            onConfirmed(ticketStr);
            toast.success(`Orden #${ticketStr} cancelada`);
            return;
          }
          if (polls < MAX_POLLS) setTimeout(tick, POLL_INTERVAL);
          else {
            onUnconfirmed(ticketStr);
            toast.error(`La cancelación de #${ticketStr} no se confirmó — verifica el estado.`, { duration: 8000 });
          }
        } catch {
          if (polls < MAX_POLLS) setTimeout(tick, POLL_INTERVAL);
          else {
            onUnconfirmed(ticketStr);
            toast.error(`La cancelación de #${ticketStr} no se confirmó — verifica el estado.`, { duration: 8000 });
          }
        }
      };
      setTimeout(tick, POLL_INTERVAL);
    } catch (e: any) {
      toast.error(translateBrokerRejection({ error: e?.message || "Network error" }));
    } finally { setSubmitting(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <AlertDialogContent className="bg-[#0c0c0c] border-neutral-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">Cancelar orden pendiente</AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-mono space-y-1">
            <div>{order.symbol} · {order.orderType} {order.side === "buy" ? "compra" : "venta"} {order.volume.toFixed(2)} lotes</div>
            <div>Precio {fmtPrice(order.symbol, order.price_open)} · Ticket #{order.ticket}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); submit(); }} disabled={submitting}
            className="bg-red-500 text-white hover:bg-red-600">
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Cancelar orden
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─────────── BulkCloseDialog ─────────── */

export type BulkScope = "all" | "winners" | "losers";

export function BulkCloseDialog({
  open, onOpenChange, scope, positions, onPerPositionPending, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: BulkScope;
  positions: LivePosition[];
  onPerPositionPending: (ticket: string, pending: boolean) => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ ticket: string; symbol: string; ok: boolean; message: string }[]>([]);

  const selected = useMemo(() => {
    if (scope === "all") return positions;
    if (scope === "winners") return positions.filter((p) => (p.net_profit ?? 0) > 0);
    return positions.filter((p) => (p.net_profit ?? 0) < 0);
  }, [scope, positions]);

  const total = selected.reduce((s, p) => s + (p.net_profit || 0), 0);
  const title = scope === "all" ? "Cerrar todas las posiciones"
              : scope === "winners" ? "Cerrar ganadoras" : "Cerrar perdedoras";

  const submit = async () => {
    if (submitting || selected.length === 0) return;
    setSubmitting(true);
    setResults([]);
    const out: typeof results = [];
    for (const p of selected) {
      const tStr = String(p.ticket);
      onPerPositionPending(tStr, true);
      try {
        const { data, error } = await supabase.functions.invoke("close-position-controlled", {
          body: {
            ticket: p.ticket, symbol: p.symbol, volume: p.volume,
            openSide: p.side, openVolume: p.volume, liveCloseConfirmed: true,
            closeId: `bulk-${tStr}-${Date.now()}`,
            clientClickAt: new Date().toISOString(),
          },
        });
        if (error) {
          out.push({ ticket: tStr, symbol: p.symbol, ok: false, message: translateBrokerRejection({ error: error.message }) });
        } else if (data?.success === true) {
          out.push({ ticket: tStr, symbol: p.symbol, ok: true, message: "Cerrada" });
        } else {
          out.push({
            ticket: tStr, symbol: p.symbol, ok: false,
            message: translateBrokerRejection({
              retcode: data?.retcode, retcodeName: data?.retcodeName,
              brokerMessage: data?.brokerMessage, error: data?.error,
              status: data?.status, reason: data?.reason,
            }),
          });
        }
      } catch (e: any) {
        out.push({ ticket: tStr, symbol: p.symbol, ok: false, message: translateBrokerRejection({ error: e?.message || "Network error" }) });
      } finally {
        onPerPositionPending(tStr, false);
      }
      setResults([...out]);
    }
    setSubmitting(false);
    const okCount = out.filter((r) => r.ok).length;
    const failCount = out.length - okCount;
    if (failCount === 0) toast.success(`${okCount} posición(es) cerrada(s).`);
    else toast.error(`${okCount} cerrada(s), ${failCount} rechazada(s). Revisa el detalle.`, { duration: 10000 });
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-lg bg-[#0c0c0c] border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <DialogDescription className="text-xs">
            {selected.length === 0
              ? "No hay posiciones que coincidan con esta selección."
              : `Se cerrarán ${selected.length} posición(es) secuencialmente al precio de mercado.`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[280px] overflow-auto rounded border border-neutral-800 bg-[#0a0a0a]">
          <table className="w-full text-[11px] font-mono">
            <thead className="bg-[#0a0a0a] sticky top-0">
              <tr className="text-left text-[9px] uppercase tracking-wider text-neutral-500">
                <th className="px-2 py-1 font-normal">Símbolo</th>
                <th className="px-2 py-1 font-normal">Lado</th>
                <th className="px-2 py-1 font-normal text-right">Vol.</th>
                <th className="px-2 py-1 font-normal text-right">P&L</th>
                <th className="px-2 py-1 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/70">
              {selected.map((p) => {
                const r = results.find((x) => x.ticket === String(p.ticket));
                return (
                  <tr key={String(p.ticket)}>
                    <td className="px-2 py-1 text-neutral-100 font-bold">{p.symbol}</td>
                    <td className="px-2 py-1 text-neutral-300">{p.side === "buy" ? "compra" : "venta"}</td>
                    <td className="px-2 py-1 text-right text-neutral-200">{p.volume.toFixed(2)}</td>
                    <td className={cn("px-2 py-1 text-right", p.net_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {fmtMoney(p.net_profit)}
                    </td>
                    <td className={cn("px-2 py-1", r ? (r.ok ? "text-emerald-400" : "text-red-400") : "text-neutral-500")}>
                      {r ? r.message : (submitting ? "Pendiente…" : "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] font-mono text-right text-neutral-400">
          Total P&L afectado: <span className={total >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtMoney(total)}</span>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            {results.length > 0 ? "Cerrar" : "Cancelar"}
          </Button>
          {selected.length > 0 && results.length === 0 && (
            <Button size="sm" onClick={submit} disabled={submitting}
              className="bg-red-500 text-white hover:bg-red-600">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Cerrar {selected.length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
