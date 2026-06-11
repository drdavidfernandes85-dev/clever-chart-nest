/**
 * Docked / Modal Order Ticket — Phase 3 (c).
 *
 * Single source of truth used by both the docked panel and OrderTicketModal.
 * Supports market / limit / stop, 4-mode SL/TP, USD/punto volume, GTD
 * datetime expiration, per-user presets (auto-fill from user_trade_presets),
 * Spanish broker-rejection mapping, and the existing fresh-tick / canary /
 * execution-mode gates already enforced by the Edge Functions.
 *
 * One-click rules:
 *   - market quick-entry (event-driven): one-click ON skips dialog
 *   - docked / modal submit button: always its own confirmation
 *   - LIMIT / STOP orders ALWAYS confirm regardless of one-click
 */
import { useEffect, useMemo, useState } from "react";
import {
  Loader2, AlertTriangle, Info, Settings, X, CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";
import { useSymbolSpec, type SymbolSpec } from "@/hooks/useSymbolSpec";
import { useTerminalProAccountSnapshot } from "@/hooks/useTerminalProAccountSnapshot";
import { usePresets, type TradePreset } from "@/hooks/usePresets";
import { translateBrokerRejection } from "@/lib/brokerRejectionEs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import TicketPresetsPanel from "@/components/terminal/TicketPresetsPanel";
import { cn } from "@/lib/utils";

interface Props {
  oneClick: boolean;
  /** Force this symbol regardless of the global watchlist selection (modal). */
  overrideSymbol?: string;
  /** Callback after a successful order — used by the modal to auto-close. */
  onOrderPlaced?: () => void;
}

type Side = "buy" | "sell";
type OrderKind = "market" | "limit" | "stop";
type Duration = "GTC" | "TODAY" | "GTD";
type SLMode = "price" | "pips" | "amount" | "pct";
type VolMode = "lots" | "usd_per_point";

function fmt(n: number | null | undefined, d = 5): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toFixed(d);
}
function fmtMoney(n: number | null | undefined, cur: string | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(2)}${cur ? " " + cur : ""}`;
}
function roundToStep(v: number, step: number): number {
  const k = Math.round(v / step);
  return Number((k * step).toFixed(8));
}
function pipSizeFor(spec: SymbolSpec | null, fallbackDigits: number): number {
  const d = spec?.digits ?? fallbackDigits;
  if (d >= 5) return 0.0001;
  if (d >= 3) return 0.01;
  return spec?.point ?? 1;
}
function pipValuePerLotFor(spec: SymbolSpec | null, fallbackDigits: number): number | null {
  if (!spec || spec.tickValue == null || spec.tickSize == null || spec.tickSize === 0) return null;
  return (spec.tickValue / spec.tickSize) * pipSizeFor(spec, fallbackDigits);
}

interface SLState { mode: SLMode; input: string }

function resolveProtection(opts: {
  state: SLState; side: Side; isStopLoss: boolean;
  entry: number | null; volume: number;
  pipSize: number; pipValuePerLot: number | null; balance: number | null;
}) {
  const { state, side, isStopLoss, entry, volume, pipSize, pipValuePerLot, balance } = opts;
  const raw = state.input.trim();
  if (!raw) return { price: null, pips: null, amount: null, pct: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { price: null, pips: null, amount: null, pct: null };
  const sign = isStopLoss ? (side === "buy" ? -1 : +1) : (side === "buy" ? +1 : -1);
  let pips: number | null = null;
  let price: number | null = null;
  if (state.mode === "price") {
    if (entry == null) return { price: null, pips: null, amount: null, pct: null };
    price = n;
    pips = (price - entry) / pipSize * (sign > 0 ? 1 : -1);
  } else if (state.mode === "pips") {
    pips = n;
    if (entry != null) price = entry + sign * n * pipSize;
  } else if (state.mode === "amount") {
    if (pipValuePerLot && volume > 0) {
      pips = n / (pipValuePerLot * volume);
      if (entry != null) price = entry + sign * pips * pipSize;
    }
  } else if (state.mode === "pct") {
    if (balance && pipValuePerLot && volume > 0) {
      const amount = balance * (n / 100);
      pips = amount / (pipValuePerLot * volume);
      if (entry != null) price = entry + sign * pips * pipSize;
    }
  }
  const amount = pips != null && pipValuePerLot != null ? pips * pipValuePerLot * volume : null;
  const pct = amount != null && balance ? (amount / balance) * 100 : null;
  return { price, pips, amount, pct };
}

const SL_MODE_LABEL: Record<SLMode, string> = {
  price: "Precio", pips: "Pips", amount: "Proyectado", pct: "% balance",
};

export default function OrderTicket({ oneClick, overrideSymbol, onOrderPlaced }: Props) {
  const { selectedBrokerSymbol } = useBrokerSymbols();
  const symbol = (overrideSymbol || selectedBrokerSymbol || "EURUSD").toUpperCase();
  const ticks = useMultiSymbolTicks([symbol]);
  const tick = ticks[symbol];
  const { spec, loading: specLoading, error: specError, missing } = useSymbolSpec(symbol);
  const account = useTerminalProAccountSnapshot();
  // Balance comes from the atomic 5s-poll snapshot — % del balance re-derives
  // every poll, so risk sizing tracks intra-session equity drift.
  const balance = account.snapshot?.balance ?? null;

  const { resolveFor: resolvePreset } = usePresets();

  const [orderKind, setOrderKind] = useState<OrderKind>("market");
  const [side, setSide] = useState<Side>("buy");
  const [volMode, setVolMode] = useState<VolMode>("lots");
  const [volumeStr, setVolumeStr] = useState<string>("0.01");
  const [entryStr, setEntryStr] = useState<string>("");
  const [duration, setDuration] = useState<Duration>("GTC");
  const [gtdDate, setGtdDate] = useState<Date | undefined>(undefined);
  const [gtdTime, setGtdTime] = useState<string>("23:59");
  const [sl, setSl] = useState<SLState>({ mode: "pips", input: "" });
  const [tp, setTp] = useState<SLState>({ mode: "pips", input: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [appliedPreset, setAppliedPreset] = useState<TradePreset | null>(null);

  const bid = tick?.bid ?? null;
  const ask = tick?.ask ?? null;
  const digits = spec?.digits ?? tick?.digits ?? 5;
  const pipSize = pipSizeFor(spec, digits);
  const pipValuePerLot = pipValuePerLotFor(spec, digits);
  const marketPrice = side === "buy" ? ask : bid;

  // Apply preset on symbol change. Symbol-specific wins over global.
  useEffect(() => {
    const preset = resolvePreset(symbol);
    if (preset) {
      setSl({ mode: preset.sl_mode, input: preset.sl_value != null ? String(preset.sl_value) : "" });
      setTp({ mode: preset.tp_mode, input: preset.tp_value != null ? String(preset.tp_value) : "" });
      if (preset.default_volume != null) setVolumeStr(String(preset.default_volume));
      else if (spec?.volumeMin != null) setVolumeStr(String(spec.volumeMin));
      setVolMode(preset.volume_mode === "usd_pt" ? "usd_per_point" : "lots");
      setAppliedPreset(preset);
    } else {
      if (spec?.volumeMin != null) setVolumeStr(String(spec.volumeMin));
      setSl({ mode: "pips", input: "" });
      setTp({ mode: "pips", input: "" });
      setAppliedPreset(null);
    }
    setEntryStr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, spec?.volumeMin, resolvePreset]);

  // Mark preset cleared when user edits SL/TP/volume manually
  const clearAppliedHint = () => setAppliedPreset(null);

  const volumeLots = useMemo<number>(() => {
    const raw = Number(volumeStr);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    if (volMode === "lots") return raw;
    if (!spec?.tickValue) return 0;
    return raw / spec.tickValue;
  }, [volumeStr, volMode, spec?.tickValue]);

  const volumeIssue = useMemo<string | null>(() => {
    if (!Number.isFinite(volumeLots) || volumeLots <= 0) return "Ingresa un volumen válido.";
    if (spec?.volumeMin != null && volumeLots + 1e-9 < spec.volumeMin) return `Volumen mínimo: ${spec.volumeMin}`;
    if (spec?.volumeMax != null && volumeLots > spec.volumeMax + 1e-9) return `Volumen máximo: ${spec.volumeMax}`;
    if (volMode === "lots" && spec?.volumeStep != null && spec.volumeStep > 0) {
      const stepsOff = Math.abs(volumeLots / spec.volumeStep - Math.round(volumeLots / spec.volumeStep));
      if (stepsOff > 1e-6) return `Paso de volumen: ${spec.volumeStep}`;
    }
    return null;
  }, [volumeLots, volMode, spec]);

  const entryPrice = useMemo<number | null>(() => {
    if (orderKind === "market") return marketPrice;
    const n = Number(entryStr);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [orderKind, entryStr, marketPrice]);

  const entryIssue = useMemo<string | null>(() => {
    if (orderKind === "market") return null;
    if (entryPrice == null) return "Ingresa el precio de entrada.";
    if (bid == null || ask == null) return null;
    if (orderKind === "limit") {
      if (side === "buy" && !(entryPrice < ask)) return "El Buy Limit debe estar por debajo del ask.";
      if (side === "sell" && !(entryPrice > bid)) return "El Sell Limit debe estar por encima del bid.";
    } else if (orderKind === "stop") {
      if (side === "buy" && !(entryPrice > ask)) return "El Buy Stop debe estar por encima del ask.";
      if (side === "sell" && !(entryPrice < bid)) return "El Sell Stop debe estar por debajo del bid.";
    }
    return null;
  }, [orderKind, entryPrice, side, bid, ask]);

  const slResolved = useMemo(
    () => resolveProtection({ state: sl, side, isStopLoss: true, entry: entryPrice, volume: volumeLots, pipSize, pipValuePerLot, balance }),
    [sl, side, entryPrice, volumeLots, pipSize, pipValuePerLot, balance],
  );
  const tpResolved = useMemo(
    () => resolveProtection({ state: tp, side, isStopLoss: false, entry: entryPrice, volume: volumeLots, pipSize, pipValuePerLot, balance }),
    [tp, side, entryPrice, volumeLots, pipSize, pipValuePerLot, balance],
  );

  const slPriceIssue = useMemo<string | null>(() => {
    if (sl.input.trim() === "") return null;
    if (slResolved.price == null) return "No se puede calcular el SL (faltan datos del bróker).";
    if (entryPrice == null) return null;
    if (side === "buy" && !(slResolved.price < entryPrice)) return "El SL debe estar por debajo de la entrada (Buy).";
    if (side === "sell" && !(slResolved.price > entryPrice)) return "El SL debe estar por encima de la entrada (Sell).";
    return null;
  }, [sl.input, slResolved.price, side, entryPrice]);

  const tpPriceIssue = useMemo<string | null>(() => {
    if (tp.input.trim() === "") return null;
    if (tpResolved.price == null) return "No se puede calcular el TP (faltan datos del bróker).";
    if (entryPrice == null) return null;
    if (side === "buy" && !(tpResolved.price > entryPrice)) return "El TP debe estar por encima de la entrada (Buy).";
    if (side === "sell" && !(tpResolved.price < entryPrice)) return "El TP debe estar por debajo de la entrada (Sell).";
    return null;
  }, [tp.input, tpResolved.price, side, entryPrice]);

  const riskAmount = slResolved.amount != null ? Math.abs(slResolved.amount) : null;
  const riskPct = slResolved.pct != null ? Math.abs(slResolved.pct) : null;
  const rr = useMemo<number | null>(() => {
    if (slResolved.pips == null || tpResolved.pips == null) return null;
    const sP = Math.abs(slResolved.pips);
    const tP = Math.abs(tpResolved.pips);
    if (sP <= 0) return null;
    return tP / sP;
  }, [slResolved.pips, tpResolved.pips]);

  const orderValue = useMemo<number | null>(() => {
    if (entryPrice == null || spec?.contractSize == null) return null;
    return entryPrice * spec.contractSize * volumeLots;
  }, [entryPrice, spec?.contractSize, volumeLots]);

  // GTD datetime → ISO string at submit
  const gtdIso = useMemo<string | null>(() => {
    if (duration !== "GTD" || !gtdDate) return null;
    const [hh, mm] = (gtdTime || "00:00").split(":").map(Number);
    const d = new Date(gtdDate);
    d.setHours(hh ?? 0, mm ?? 0, 0, 0);
    return d.toISOString();
  }, [duration, gtdDate, gtdTime]);

  const gtdIssue = duration === "GTD" && (!gtdDate || (gtdIso != null && new Date(gtdIso).getTime() <= Date.now()))
    ? "Selecciona una fecha/hora futura."
    : null;

  const stepLots = (delta: number) => {
    clearAppliedHint();
    const step = spec?.volumeStep ?? 0.01;
    const min = spec?.volumeMin ?? step;
    const max = spec?.volumeMax ?? Number.POSITIVE_INFINITY;
    const cur = volMode === "lots" ? Number(volumeStr) || 0 : volumeLots;
    const next = Math.min(max, Math.max(min, roundToStep(cur + delta, step)));
    if (volMode === "lots") setVolumeStr(String(next));
    else if (spec?.tickValue) setVolumeStr((next * spec.tickValue).toFixed(2));
  };

  const canSubmit =
    !submitting && spec != null &&
    !volumeIssue && !entryIssue && !slPriceIssue && !tpPriceIssue && !gtdIssue &&
    entryPrice != null && entryPrice > 0;

  const tradeIdPrefix = orderKind === "market" ? "tp-mkt" : orderKind === "limit" ? "tp-lim" : "tp-stp";

  const doSubmit = async () => {
    if (!spec || !canSubmit) return;
    setSubmitting(true);
    try {
      const tradeId = `${tradeIdPrefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const slPrice = sl.input.trim() ? slResolved.price : null;
      const tpPrice = tp.input.trim() ? tpResolved.price : null;
      const slRounded = slPrice != null ? Number(slPrice.toFixed(digits)) : null;
      const tpRounded = tpPrice != null ? Number(tpPrice.toFixed(digits)) : null;
      const volumeRounded = Number(volumeLots.toFixed(8));

      let res: any;
      if (orderKind === "market") {
        const { data, error } = await supabase.functions.invoke("submit-best-execution-order", {
          body: { tradeId, symbol, side, orderType: "market", volume: volumeRounded, stopLoss: slRounded, takeProfit: tpRounded },
        });
        if (error) throw error;
        res = data;
      } else {
        const pendingType =
          orderKind === "limit"
            ? side === "buy" ? "buy_limit" : "sell_limit"
            : side === "buy" ? "buy_stop" : "sell_stop";
        const expirationType = duration === "GTC" ? "GTC" : duration === "TODAY" ? "TODAY" : "SPECIFIED";
        const { data, error } = await supabase.functions.invoke("submit-pending-order", {
          body: {
            tradeId, symbol, pendingType,
            volume: volumeRounded,
            entryPrice: Number((entryPrice as number).toFixed(digits)),
            stopLoss: slRounded, takeProfit: tpRounded,
            expirationType,
            expirationTime: duration === "GTD" ? gtdIso : null,
          },
        });
        if (error) throw error;
        res = data;
      }

      if (res?.success === true) {
        const ticket = res?.ticket || res?.orderId || res?.order_id || null;
        toast.success(ticket ? `${orderKind === "market" ? "Orden ejecutada" : "Orden pendiente colocada"} — ticket ${ticket}` : "Orden enviada correctamente");
        window.dispatchEvent(new Event("mt:refresh-positions"));
        onOrderPlaced?.();
      } else {
        toast.error(
          translateBrokerRejection({
            retcode: res?.retcode,
            retcodeName: res?.retcodeName ?? res?.retcode_name,
            retcodeDescription: res?.retcodeDescription ?? res?.retcode_description,
            brokerMessage: res?.brokerMessage ?? res?.message,
            error: res?.error, status: res?.status, reason: res?.reason,
          }),
          { duration: 8000 },
        );
      }
    } catch (e: any) {
      toast.error(translateBrokerRejection({ error: e?.message || "Network error" }), { duration: 8000 });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleSubmitClick = () => {
    if (!canSubmit) return;
    // One-click ONLY skips dialog for MARKET orders. Pending always confirms.
    if (oneClick && orderKind === "market") doSubmit();
    else setConfirmOpen(true);
  };

  const actionLabel = useMemo(() => {
    const verb = side === "buy" ? "Comprar" : "Vender";
    if (orderKind === "market") return `${verb} ${volumeLots.toFixed(2)} ${symbol} @ mercado (${fmt(marketPrice, digits)})`;
    const kindLabel = orderKind === "limit" ? "Límite" : "Stop";
    return `${verb} ${kindLabel} ${volumeLots.toFixed(2)} ${symbol} @ ${fmt(entryPrice, digits)}`;
  }, [side, orderKind, volumeLots, symbol, marketPrice, entryPrice, digits]);

  return (
    <div className="flex h-full flex-col bg-[#111214]">
      <div className="border-b border-neutral-800 px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-200">Nueva orden</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-[#FFCD05]">{symbol}</span>
          <button
            type="button"
            onClick={() => setPresetsOpen(true)}
            className="p-1 rounded text-neutral-500 hover:text-[#FFCD05] hover:bg-[#FFCD05]/10"
            title="Presets"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {appliedPreset && (
        <div className="border-b border-neutral-800 bg-[#FFCD05]/5 px-3 py-1 flex items-center justify-between text-[10px]">
          <span className="text-[#FFCD05] font-mono">
            Preset aplicado · {appliedPreset.symbol ?? "Global"}
          </span>
          <button
            type="button"
            onClick={() => {
              setAppliedPreset(null);
              setSl({ mode: "pips", input: "" });
              setTp({ mode: "pips", input: "" });
              if (spec?.volumeMin != null) setVolumeStr(String(spec.volumeMin));
            }}
            className="p-0.5 rounded text-neutral-500 hover:text-neutral-200"
            title="Limpiar preset"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Order type tabs */}
      <div className="grid grid-cols-3 border-b border-neutral-800 shrink-0 text-[10px] uppercase tracking-wider">
        {(["market", "limit", "stop"] as OrderKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setOrderKind(k)}
            className={cn(
              "py-1.5 transition",
              orderKind === k
                ? "bg-[#1a1a1d] text-[#FFCD05] font-bold border-b-2 border-[#FFCD05]"
                : "text-neutral-500 hover:text-neutral-200",
            )}
          >
            {k === "market" ? "Mercado" : k === "limit" ? "Límite" : "Stop"}
          </button>
        ))}
      </div>

      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-px bg-neutral-800 shrink-0">
        <button
          type="button" onClick={() => setSide("sell")}
          className={cn("px-2 py-2 text-left transition", side === "sell" ? "bg-red-500/20 ring-1 ring-red-500/60" : "bg-[#16171a] hover:bg-neutral-900")}
        >
          <div className="text-[9px] uppercase tracking-wider text-red-400 font-bold">Vender · Bid</div>
          <div className="font-mono text-base font-semibold text-red-400 tabular-nums">{fmt(bid, digits)}</div>
        </button>
        <button
          type="button" onClick={() => setSide("buy")}
          className={cn("px-2 py-2 text-right transition", side === "buy" ? "bg-emerald-500/20 ring-1 ring-emerald-500/60" : "bg-[#16171a] hover:bg-neutral-900")}
        >
          <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">Comprar · Ask</div>
          <div className="font-mono text-base font-semibold text-emerald-400 tabular-nums">{fmt(ask, digits)}</div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {specLoading && !spec ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando especificación…
          </div>
        ) : specError ? (
          <div className="rounded border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-300">{specError}</div>
        ) : (
          <>
            {missing.length > 0 && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-300 flex gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <div>El bróker no devolvió: <span className="font-mono">{missing.join(", ")}</span>. Algunos cálculos pueden no estar disponibles.</div>
              </div>
            )}

            {orderKind !== "market" && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-neutral-500">Precio de entrada</label>
                <input
                  type="number" inputMode="decimal"
                  value={entryStr}
                  onChange={(e) => { clearAppliedHint(); setEntryStr(e.target.value); }}
                  step={pipSize}
                  placeholder={fmt(marketPrice, digits)}
                  className="w-full bg-[#16171a] text-center text-sm font-mono font-semibold text-neutral-100 outline-none focus:bg-neutral-900 tabular-nums rounded px-2 py-1.5 border border-neutral-800"
                />
                {entryIssue && <div className="text-[10px] text-red-400">{entryIssue}</div>}
              </div>
            )}

            {/* Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wider text-neutral-500">
                  {volMode === "lots" ? "Volumen (lotes)" : "Volumen (USD/punto)"}
                </label>
                <div className="flex bg-neutral-900 rounded overflow-hidden text-[9px]">
                  {(["lots", "usd_per_point"] as VolMode[]).map((m) => (
                    <button
                      key={m} type="button"
                      onClick={() => {
                        if (m === volMode) return;
                        if (m === "usd_per_point" && spec?.tickValue) setVolumeStr((volumeLots * spec.tickValue).toFixed(2));
                        else if (m === "lots") setVolumeStr(volumeLots.toFixed(2));
                        setVolMode(m);
                      }}
                      className={cn("px-1.5 py-0.5 uppercase tracking-wider", volMode === m ? "bg-[#FFCD05] text-black font-bold" : "text-neutral-500 hover:text-neutral-200")}
                    >
                      {m === "lots" ? "Lotes" : "USD/pt"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-stretch gap-px bg-neutral-800 rounded overflow-hidden">
                <button type="button" onClick={() => stepLots(-(spec?.volumeStep ?? 0.01))} className="px-2 bg-[#16171a] hover:bg-neutral-900 text-neutral-300 text-sm">−</button>
                <input
                  type="number" inputMode="decimal"
                  value={volumeStr}
                  onChange={(e) => { clearAppliedHint(); setVolumeStr(e.target.value); }}
                  placeholder="0.0"
                  className="flex-1 bg-[#16171a] text-center text-sm font-mono font-semibold text-neutral-100 outline-none focus:bg-neutral-900 tabular-nums"
                />
                <button type="button" onClick={() => stepLots(spec?.volumeStep ?? 0.01)} className="px-2 bg-[#16171a] hover:bg-neutral-900 text-neutral-300 text-sm">+</button>
              </div>
              {volumeIssue ? (
                <div className="text-[10px] text-red-400">{volumeIssue}</div>
              ) : spec && (
                <div className="text-[9px] text-neutral-600 font-mono">
                  {volMode === "usd_per_point" && <>= {volumeLots.toFixed(4)} lotes · </>}
                  Mín {spec.volumeMin ?? "—"} · Máx {spec.volumeMax ?? "—"} · Paso {spec.volumeStep ?? "—"}
                </div>
              )}
            </div>

            {/* Duration */}
            {orderKind !== "market" && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-neutral-500">Vigencia</label>
                <div className="grid grid-cols-3 gap-px bg-neutral-800 rounded overflow-hidden">
                  {(["GTC", "TODAY", "GTD"] as Duration[]).map((d) => (
                    <button
                      key={d} type="button" onClick={() => setDuration(d)}
                      className={cn("py-1 text-[10px] uppercase tracking-wider", duration === d ? "bg-[#FFCD05] text-black font-bold" : "bg-[#16171a] text-neutral-400 hover:text-neutral-200")}
                    >
                      {d === "GTC" ? "Hasta cancelar" : d === "TODAY" ? "Hoy" : "GTD"}
                    </button>
                  ))}
                </div>
                {duration === "GTD" && (
                  <div className="flex gap-1 mt-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline" size="sm"
                          className={cn("flex-1 h-7 justify-start text-left font-normal bg-[#16171a] border-neutral-800 text-neutral-200 text-[11px]",
                            !gtdDate && "text-neutral-500")}
                        >
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {gtdDate ? format(gtdDate, "dd MMM yyyy") : "Fecha…"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single" selected={gtdDate} onSelect={setGtdDate}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <input
                      type="time" value={gtdTime} onChange={(e) => setGtdTime(e.target.value)}
                      className="w-[88px] bg-[#16171a] border border-neutral-800 rounded text-[11px] font-mono text-neutral-200 px-1.5 outline-none"
                    />
                  </div>
                )}
                {gtdIssue && <div className="text-[10px] text-red-400">{gtdIssue}</div>}
                {duration === "GTD" && gtdIso && !gtdIssue && (
                  <div className="text-[9px] text-neutral-600 font-mono">Expira en UTC: {new Date(gtdIso).toISOString()}</div>
                )}
              </div>
            )}

            {/* SL & TP */}
            <ProtectionBlock label="Stop Loss" accent="red"
              state={sl} setState={(s) => { clearAppliedHint(); setSl(s); }}
              resolved={slResolved} digits={digits}
              currency={spec?.currencyProfit ?? null} issue={slPriceIssue} />
            <ProtectionBlock label="Take Profit" accent="emerald"
              state={tp} setState={(s) => { clearAppliedHint(); setTp(s); }}
              resolved={tpResolved} digits={digits}
              currency={spec?.currencyProfit ?? null} issue={tpPriceIssue} />

            <div className="space-y-1.5 rounded border border-neutral-800 bg-[#0e0e10] p-2">
              <Row label="Precio de referencia" value={fmt(orderKind === "market" ? marketPrice : entryPrice, digits)} mono />
              <Row label="Valor de la orden" value={orderValue != null && spec?.currencyProfit ? `${orderValue.toFixed(2)} ${spec.currencyProfit}` : "—"} mono />
              <Row label="Valor del pip / lote" value={pipValuePerLot != null && spec?.currencyProfit ? `${pipValuePerLot.toFixed(4)} ${spec.currencyProfit}` : "—"} mono />
              <Row label="Impacto en margen" value={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-neutral-500">no disponible <Info className="h-3 w-3" /></span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">
                    Pendiente de habilitar en el broker. El feed de ejecución (Trading Layer) no expone el requerimiento de margen pre-trade.
                  </TooltipContent>
                </Tooltip>
              } />
            </div>
          </>
        )}
      </div>

      <div className="border-t border-neutral-800 p-2 shrink-0">
        <button
          type="button" onClick={handleSubmitClick} disabled={!canSubmit}
          className={cn(
            "w-full rounded py-2 text-xs font-bold uppercase tracking-wider transition",
            side === "buy"
              ? "bg-emerald-500 hover:bg-emerald-400 text-black disabled:bg-emerald-500/30 disabled:text-emerald-200/60"
              : "bg-red-500 hover:bg-red-400 text-black disabled:bg-red-500/30 disabled:text-red-200/60",
            !canSubmit && "cursor-not-allowed",
          )}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2 justify-center"><Loader2 className="h-3 w-3 animate-spin" /> Enviando…</span>
          ) : actionLabel}
        </button>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="rounded bg-[#0e0e10] border border-neutral-800 px-2 py-1">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Riesgo</div>
            <div className="text-red-300 tabular-nums">
              {riskAmount != null ? fmtMoney(riskAmount, spec?.currencyProfit) : "—"}
              {riskPct != null && <span className="text-neutral-500"> · {riskPct.toFixed(2)}%</span>}
            </div>
          </div>
          <div className="rounded bg-[#0e0e10] border border-neutral-800 px-2 py-1">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">R : R</div>
            <div className="text-emerald-300 tabular-nums">{rr != null ? `1 : ${rr.toFixed(2)}` : "—"}</div>
          </div>
        </div>
        <div className="mt-1 text-center text-[9px] uppercase tracking-[0.18em] text-neutral-600">
          {oneClick
            ? (orderKind === "market" ? "1-clic activo · sin confirmación" : "1-clic activo · pendiente igual pide confirmación")
            : "Confirmación habilitada"}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar {orderKind === "market" ? "orden de mercado" : orderKind === "limit" ? "orden límite" : "orden stop"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="font-mono text-base font-bold text-foreground">{actionLabel}</div>
                <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                  <div className="text-muted-foreground">Stop Loss</div>
                  <div className="text-right">{slResolved.price != null ? fmt(slResolved.price, digits) : "—"}</div>
                  <div className="text-muted-foreground">Take Profit</div>
                  <div className="text-right">{tpResolved.price != null ? fmt(tpResolved.price, digits) : "—"}</div>
                  <div className="text-muted-foreground">Riesgo</div>
                  <div className="text-right text-red-400">{riskAmount != null ? fmtMoney(riskAmount, spec?.currencyProfit) : "—"}{riskPct != null && ` · ${riskPct.toFixed(2)}%`}</div>
                  <div className="text-muted-foreground">R : R</div>
                  <div className="text-right text-emerald-400">{rr != null ? `1 : ${rr.toFixed(2)}` : "—"}</div>
                  {orderKind !== "market" && (
                    <>
                      <div className="text-muted-foreground">Vigencia</div>
                      <div className="text-right">
                        {duration === "GTC" ? "Hasta cancelar" : duration === "TODAY" ? "Hoy" : `GTD · ${gtdIso ? new Date(gtdIso).toLocaleString() : "—"}`}
                      </div>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {orderKind === "market"
                    ? "Se enviará al bróker a precio de mercado. El precio final puede variar por slippage."
                    : "Se enviará como orden pendiente. El bróker rechazará la orden si el precio queda del lado equivocado al momento de procesarla."}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit} disabled={submitting}
              className={cn(side === "buy" ? "bg-emerald-500 hover:bg-emerald-400 text-black" : "bg-red-500 hover:bg-red-400 text-black")}>
              {submitting ? "Enviando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TicketPresetsPanel open={presetsOpen} onOpenChange={setPresetsOpen} />
    </div>
  );
}

function ProtectionBlock({
  label, accent, state, setState, resolved, digits, currency, issue,
}: {
  label: string; accent: "red" | "emerald";
  state: SLState; setState: (s: SLState) => void;
  resolved: { price: number | null; pips: number | null; amount: number | null; pct: number | null };
  digits: number; currency: string | null; issue: string | null;
}) {
  const accentText = accent === "red" ? "text-red-400" : "text-emerald-400";
  return (
    <div className="space-y-1 rounded border border-neutral-800 bg-[#0e0e10] p-2">
      <div className="flex items-center justify-between">
        <label className={cn("text-[10px] uppercase tracking-wider font-bold", accentText)}>{label}</label>
        <div className="flex bg-neutral-900 rounded overflow-hidden text-[9px]">
          {(Object.keys(SL_MODE_LABEL) as SLMode[]).map((m) => (
            <button
              key={m} type="button"
              onClick={() => setState({ ...state, mode: m })}
              className={cn("px-1.5 py-0.5 uppercase tracking-wider", state.mode === m ? "bg-[#FFCD05] text-black font-bold" : "text-neutral-500 hover:text-neutral-200")}
            >
              {SL_MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <input
        type="number" inputMode="decimal"
        value={state.input}
        onChange={(e) => setState({ ...state, input: e.target.value })}
        placeholder="0.0"
        className="w-full bg-[#16171a] text-center text-sm font-mono font-semibold text-neutral-100 outline-none focus:bg-neutral-900 tabular-nums rounded px-2 py-1 border border-neutral-800"
      />
      <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-neutral-500">
        <Cell label="Precio" value={resolved.price != null ? fmt(resolved.price, digits) : "—"} active={state.mode === "price"} muted={state.input.trim() === ""} />
        <Cell label="Pips" value={resolved.pips != null ? Math.abs(resolved.pips).toFixed(1) : "—"} active={state.mode === "pips"} muted={state.input.trim() === ""} />
        <Cell label="Monto" value={resolved.amount != null ? fmtMoney(Math.abs(resolved.amount), currency) : "—"} active={state.mode === "amount"} muted={state.input.trim() === ""} />
        <Cell label="%" value={resolved.pct != null ? `${Math.abs(resolved.pct).toFixed(2)}%` : "—"} active={state.mode === "pct"} muted={state.input.trim() === ""} />
      </div>
      {issue && <div className="text-[10px] text-red-400">{issue}</div>}
    </div>
  );
}

function Cell({ label, value, active, muted }: { label: string; value: string; active: boolean; muted?: boolean }) {
  return (
    <div className={cn("rounded px-1 py-0.5 text-center", active ? "bg-[#1a1a1d] text-neutral-200" : "", muted && "opacity-50")}>
      <div className="text-[8px] uppercase tracking-wider text-neutral-600">{label}</div>
      <div className="tabular-nums">{value}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-neutral-500">{label}</span>
      <span className={cn("text-neutral-100", mono && "font-mono tabular-nums")}>{value}</span>
    </div>
  );
}
