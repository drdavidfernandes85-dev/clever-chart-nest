/**
 * Docked Order Ticket — Phase 3 (a): Market orders only.
 *
 * - Side toggle (Sell red / Buy green) with live Bid/Ask
 * - Volume input validated against TL spec (volumeMin/Max/Step)
 * - Pip value display per lot
 * - "Impacto en margen: no disponible" tooltip — TL has no pre-trade margin endpoint
 * - Submit button shows full action; routes through submit-best-execution-order
 * - Spanish broker-rejection mapping (translateBrokerRejection)
 * - Confirmation dialog when one-click is OFF (docked ticket already acts as its
 *   own confirmation per spec, but we still confirm market orders unless the
 *   user has explicitly enabled 1-click)
 *
 * Limit/Stop tabs + 4-mode SL/TP will land in sub-phase (b).
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";
import { useSymbolSpec } from "@/hooks/useSymbolSpec";
import { translateBrokerRejection } from "@/lib/brokerRejectionEs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Props {
  oneClick: boolean;
}

type Side = "buy" | "sell";

function fmt(n: number | null | undefined, d = 5): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toFixed(d);
}

function roundToStep(v: number, step: number): number {
  const k = Math.round(v / step);
  return Number((k * step).toFixed(8));
}

export default function OrderTicket({ oneClick }: Props) {
  const { selectedBrokerSymbol } = useBrokerSymbols();
  const symbol = (selectedBrokerSymbol || "EURUSD").toUpperCase();
  const ticks = useMultiSymbolTicks([symbol]);
  const tick = ticks[symbol];
  const { spec, loading: specLoading, error: specError, missing } = useSymbolSpec(symbol);

  const [side, setSide] = useState<Side>("buy");
  const [volumeStr, setVolumeStr] = useState<string>("0.01");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // When user picks a new symbol, reset volume to the broker minimum.
  useEffect(() => {
    if (spec?.volumeMin != null) setVolumeStr(String(spec.volumeMin));
  }, [spec?.symbol, spec?.volumeMin]);

  const volume = Number(volumeStr);
  const bid = tick?.bid ?? null;
  const ask = tick?.ask ?? null;
  const digits = spec?.digits ?? tick?.digits ?? 5;
  const price = side === "buy" ? ask : bid;

  // Volume validation against TL spec.
  const volumeIssue = useMemo<string | null>(() => {
    if (!Number.isFinite(volume) || volume <= 0) return "Ingresa un volumen válido.";
    if (spec?.volumeMin != null && volume < spec.volumeMin)
      return `Volumen mínimo: ${spec.volumeMin}`;
    if (spec?.volumeMax != null && volume > spec.volumeMax)
      return `Volumen máximo: ${spec.volumeMax}`;
    if (spec?.volumeStep != null && spec.volumeStep > 0) {
      const stepsOff = Math.abs(volume / spec.volumeStep - Math.round(volume / spec.volumeStep));
      if (stepsOff > 1e-6) return `Paso de volumen: ${spec.volumeStep}`;
    }
    return null;
  }, [volume, spec]);

  // Per-lot pip value (broker tickValue is per 1.0 lot at tickSize).
  // We DO NOT compute margin client-side — TL exposes no margin endpoint.
  const pipValuePerLot = useMemo<number | null>(() => {
    if (spec?.tickValue == null || spec?.tickSize == null || spec.tickSize === 0) return null;
    const d = spec.digits ?? 5;
    const pipSize = d >= 5 ? 0.0001 : d >= 3 ? 0.01 : 1;
    return (spec.tickValue / spec.tickSize) * pipSize;
  }, [spec]);

  const orderValue = useMemo<number | null>(() => {
    if (price == null || spec?.contractSize == null) return null;
    return price * spec.contractSize * volume;
  }, [price, spec?.contractSize, volume]);

  const stepBy = (delta: number) => {
    const step = spec?.volumeStep ?? 0.01;
    const min = spec?.volumeMin ?? step;
    const max = spec?.volumeMax ?? Number.POSITIVE_INFINITY;
    const next = Math.min(max, Math.max(min, roundToStep((Number(volumeStr) || 0) + delta, step)));
    setVolumeStr(String(next));
  };

  const canSubmit =
    !submitting &&
    spec != null &&
    !volumeIssue &&
    price != null &&
    price > 0;

  const doSubmit = async () => {
    if (!spec || !canSubmit) return;
    setSubmitting(true);
    try {
      const tradeId = `tp-mkt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const { data, error } = await supabase.functions.invoke(
        "submit-best-execution-order",
        {
          body: {
            tradeId,
            symbol,
            side,
            orderType: "market",
            volume,
          },
        },
      );
      if (error) throw error;
      const res = data as any;
      if (res?.success === true) {
        const ticket = res?.ticket || res?.orderId || res?.order_id || null;
        toast.success(
          ticket
            ? `Orden ejecutada — ticket ${ticket}`
            : "Orden ejecutada correctamente",
        );
        window.dispatchEvent(new Event("mt:refresh-positions"));
      } else {
        toast.error(
          translateBrokerRejection({
            retcode: res?.retcode,
            retcodeName: res?.retcodeName ?? res?.retcode_name,
            retcodeDescription: res?.retcodeDescription ?? res?.retcode_description,
            brokerMessage: res?.brokerMessage ?? res?.message,
            error: res?.error,
            status: res?.status,
            reason: res?.reason,
          }),
          { duration: 8000 },
        );
      }
    } catch (e: any) {
      toast.error(
        translateBrokerRejection({ error: e?.message || "Network error" }),
        { duration: 8000 },
      );
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleSubmitClick = () => {
    if (!canSubmit) return;
    if (oneClick) doSubmit();
    else setConfirmOpen(true);
  };

  const actionLabel = `${side === "buy" ? "Comprar" : "Vender"} ${volume.toFixed(2)} ${symbol} a ${fmt(price, digits)}`;

  return (
    <div className="flex h-full flex-col bg-[#111214]">
      {/* Header */}
      <div className="border-b border-neutral-800 px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-200">
          Nueva orden
        </span>
        <span className="font-mono text-[11px] font-semibold text-[#FFCD05]">{symbol}</span>
      </div>

      {/* Order type tabs — Market only in 3a; Limit/Stop disabled */}
      <div className="grid grid-cols-3 border-b border-neutral-800 shrink-0 text-[10px] uppercase tracking-wider">
        <button className="py-1.5 bg-[#1a1a1d] text-[#FFCD05] font-bold border-b-2 border-[#FFCD05]">
          Mercado
        </button>
        <button disabled className="py-1.5 text-neutral-600 cursor-not-allowed" title="Disponible en la fase 3b">
          Límite
        </button>
        <button disabled className="py-1.5 text-neutral-600 cursor-not-allowed" title="Disponible en la fase 3b">
          Stop
        </button>
      </div>

      {/* Side toggle with live prices */}
      <div className="grid grid-cols-2 gap-px bg-neutral-800 shrink-0">
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={cn(
            "px-2 py-2 text-left transition",
            side === "sell" ? "bg-red-500/20 ring-1 ring-red-500/60" : "bg-[#16171a] hover:bg-neutral-900",
          )}
        >
          <div className="text-[9px] uppercase tracking-wider text-red-400 font-bold">Vender · Bid</div>
          <div className="font-mono text-base font-semibold text-red-400 tabular-nums">
            {fmt(bid, digits)}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={cn(
            "px-2 py-2 text-right transition",
            side === "buy" ? "bg-emerald-500/20 ring-1 ring-emerald-500/60" : "bg-[#16171a] hover:bg-neutral-900",
          )}
        >
          <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">Comprar · Ask</div>
          <div className="font-mono text-base font-semibold text-emerald-400 tabular-nums">
            {fmt(ask, digits)}
          </div>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {specLoading && !spec ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando especificación…
          </div>
        ) : specError ? (
          <div className="rounded border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-300">
            {specError}
          </div>
        ) : (
          <>
            {/* Missing-spec banner */}
            {missing.length > 0 && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-300 flex gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <div>
                  El bróker no devolvió: <span className="font-mono">{missing.join(", ")}</span>.
                  Algunos cálculos pueden no estar disponibles.
                </div>
              </div>
            )}

            {/* Volume */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-neutral-500">
                Volumen (lotes)
              </label>
              <div className="flex items-stretch gap-px bg-neutral-800 rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => stepBy(-(spec?.volumeStep ?? 0.01))}
                  className="px-2 bg-[#16171a] hover:bg-neutral-900 text-neutral-300 text-sm"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={volumeStr}
                  onChange={(e) => setVolumeStr(e.target.value)}
                  step={spec?.volumeStep ?? 0.01}
                  min={spec?.volumeMin ?? 0.01}
                  max={spec?.volumeMax ?? undefined}
                  className="flex-1 bg-[#16171a] text-center text-sm font-mono font-semibold text-neutral-100 outline-none focus:bg-neutral-900 tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => stepBy(spec?.volumeStep ?? 0.01)}
                  className="px-2 bg-[#16171a] hover:bg-neutral-900 text-neutral-300 text-sm"
                >
                  +
                </button>
              </div>
              {volumeIssue ? (
                <div className="text-[10px] text-red-400">{volumeIssue}</div>
              ) : spec && (
                <div className="text-[9px] text-neutral-600 font-mono">
                  Mín {spec.volumeMin ?? "—"} · Máx {spec.volumeMax ?? "—"} · Paso {spec.volumeStep ?? "—"}
                </div>
              )}
            </div>

            {/* Live calculated fields */}
            <div className="space-y-1.5 rounded border border-neutral-800 bg-[#0e0e10] p-2">
              <Row label="Precio actual" value={fmt(price, digits)} mono />
              <Row
                label="Valor de la orden"
                value={
                  orderValue != null && spec?.currencyProfit
                    ? `${orderValue.toFixed(2)} ${spec.currencyProfit}`
                    : "—"
                }
                mono
              />
              <Row
                label="Valor del pip / lote"
                value={
                  pipValuePerLot != null && spec?.currencyProfit
                    ? `${pipValuePerLot.toFixed(4)} ${spec.currencyProfit}`
                    : "—"
                }
                mono
              />
              <Row
                label="Impacto en margen"
                value={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-neutral-500">
                        no disponible <Info className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] text-xs">
                      Pendiente de habilitar en el broker. El feed de ejecución (Trading Layer) no expone el requerimiento de margen pre-trade.
                    </TooltipContent>
                  </Tooltip>
                }
              />
            </div>
          </>
        )}
      </div>

      {/* Footer / submit */}
      <div className="border-t border-neutral-800 p-2 shrink-0">
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={!canSubmit}
          className={cn(
            "w-full rounded py-2 text-xs font-bold uppercase tracking-wider transition",
            side === "buy"
              ? "bg-emerald-500 hover:bg-emerald-400 text-black disabled:bg-emerald-500/30 disabled:text-emerald-200/60"
              : "bg-red-500 hover:bg-red-400 text-black disabled:bg-red-500/30 disabled:text-red-200/60",
            !canSubmit && "cursor-not-allowed",
          )}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <Loader2 className="h-3 w-3 animate-spin" /> Enviando…
            </span>
          ) : (
            actionLabel
          )}
        </button>
        <div className="mt-1 text-center text-[9px] uppercase tracking-[0.18em] text-neutral-600">
          {oneClick ? "1-click activo · sin confirmación" : "Confirmación habilitada"}
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar orden de mercado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="font-mono text-base font-bold text-foreground">{actionLabel}</div>
                <div className="text-xs text-muted-foreground">
                  Se enviará al bróker a precio de mercado. El precio final puede variar por slippage.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doSubmit}
              disabled={submitting}
              className={cn(
                side === "buy" ? "bg-emerald-500 hover:bg-emerald-400 text-black" : "bg-red-500 hover:bg-red-400 text-black",
              )}
            >
              {submitting ? "Enviando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-neutral-500">{label}</span>
      <span className={cn("text-neutral-100", mono && "font-mono tabular-nums")}>{value}</span>
    </div>
  );
}
