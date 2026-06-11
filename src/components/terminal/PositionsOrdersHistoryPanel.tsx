/**
 * PositionsOrdersHistoryPanel — Phase 5(a) read-only panels.
 *
 * Three tabs:
 *   - Posiciones: open positions (live row P&L bridges 5s broker poll using
 *     side-correct tick values from get-mt5-terminal-data /specs).
 *   - Órdenes: pending orders (live distance from market in pips).
 *   - Historial: paginated /history/orders and /history/deals.
 *
 * No action buttons. Cancel/modify/close belong to 5(b).
 *
 * Single price feed: live ticks come from useMultiSymbolTicks (TL WS via
 * MarketDataService). Broker snapshot comes from get-mt5-terminal-data (5s).
 * Footer "Total" must reconcile against the account bar's P&L abierto at
 * every poll boundary (bar = account.profit, sum(rows.net_profit) ≈ same).
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, Pencil, X as XIcon, Slice } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";
import { fmtMoney } from "@/contexts/LiveAccountContext";
import {
  ModifyProtectionDialog, CloseConfirmDialog, PartialCloseDialog,
  CancelOrderConfirmDialog, BulkCloseDialog,
  type LivePosition, type PendingOrderLite, type BulkScope,
} from "@/components/terminal/PositionActionDialogs";

/* ─────────── shared ─────────── */

const fmtPrice = (sym: string, v: number | null | undefined) => {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) === 0) return "—";
  const u = (sym || "").toUpperCase();
  const d = u.includes("JPY") ? 3
    : u.includes("XAU") || u.includes("BTC") || u.includes("ETH") ? 2
    : 5;
  return Number(v).toFixed(d);
};

const fmtDateTime = (epochSecOrIso: number | string | null | undefined): string => {
  if (epochSecOrIso == null) return "—";
  const n = typeof epochSecOrIso === "number" ? epochSecOrIso : Date.parse(String(epochSecOrIso)) / 1000;
  if (!Number.isFinite(n) || n <= 0) return "—";
  const d = new Date(n * 1000);
  return d.toLocaleString("es-419", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const pipSizeFor = (digits: number | null | undefined): number => {
  const d = digits ?? 5;
  if (d >= 5) return 0.0001;
  if (d >= 3) return 0.01;
  return 1;
};

/* ─────────── types ─────────── */

interface Position {
  ticket: number | string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entry_price: number;
  current_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  swap: number;
  commission: number;
  net_profit: number;
  time_open: number | null;
  time_open_msc: number | null;
}

interface PendingOrder {
  ticket: number | string;
  symbol: string;
  orderType: string;
  side: "buy" | "sell";
  volume: number;
  price_open: number;
  price_stoplimit: number | null;
  price_current: number;
  stop_loss: number | null;
  take_profit: number | null;
  duration: string;
  time_setup: number | null;
  time_expiration: number | null;
}

/* ─────────── data source ─────────── */

interface SnapshotState {
  positions: Position[];
  pendingOrders: PendingOrder[];
  accountProfit: number | null;
  balance: number | null;
  currency: string;
  asOf: number;
  connected: boolean;
  loading: boolean;
  staleCount: number;
  lastError: string | null;
}

function usePositionsAndOrdersSnapshot(): SnapshotState & { refresh: () => void } {
  const [s, setS] = useState<SnapshotState>({
    positions: [], pendingOrders: [], accountProfit: null, balance: null, currency: "USD",
    asOf: 0, connected: false, loading: true, staleCount: 0, lastError: null,
  });

  const fetchOnce = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-mt5-terminal-data", { body: {} });
      if (error) {
        setS((p) => ({ ...p, loading: false, staleCount: p.staleCount + 1, lastError: error.message }));
        return;
      }
      if (data?.success !== true) {
        setS((p) => ({ ...p, loading: false, connected: false, lastError: data?.error ?? "Sin cuenta conectada" }));
        return;
      }
      setS({
        positions: Array.isArray(data.positions) ? data.positions : [],
        pendingOrders: Array.isArray(data.pendingOrders) ? data.pendingOrders : [],
        accountProfit: data.account?.profit ?? null,
        balance: data.account?.balance ?? null,
        currency: data.account?.currency ?? "USD",
        asOf: Date.now(),
        connected: true,
        loading: false,
        staleCount: 0,
        lastError: null,
      });
    } catch (e: any) {
      setS((p) => ({ ...p, loading: false, staleCount: p.staleCount + 1, lastError: e?.message ?? "Network error" }));
    }
  };

  useEffect(() => {
    fetchOnce();
    const id = window.setInterval(fetchOnce, 5_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...s, refresh: fetchOnce };
}

/* ─────────── tab: positions ─────────── */

function PositionsTab({ snap, refresh, balance }: { snap: SnapshotState; refresh: () => void; balance: number | null }) {
  const symbols = useMemo(
    () => Array.from(new Set(snap.positions.map((p) => p.symbol))),
    [snap.positions],
  );
  const ticks = useMultiSymbolTicks(symbols);

  const rows = useMemo(() => snap.positions.map((p) => {
    const t = ticks[p.symbol];
    const livePrice = p.side === "buy" ? (t?.bid ?? p.current_price) : (t?.ask ?? p.current_price);
    return { ...p, live_price: Number.isFinite(livePrice) && livePrice > 0 ? livePrice : p.current_price };
  }), [snap.positions, ticks]);

  const totalNet = rows.reduce((s, r) => s + (Number(r.net_profit) || 0), 0);
  const totalGross = rows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  const reconcilesWithBar =
    snap.accountProfit == null ? true
      : Math.abs(totalGross - snap.accountProfit) <= Math.max(0.05, Math.abs(snap.accountProfit) * 0.005);

  // In-flight row state — drives "Cerrando…" / "Modificando…" without mutating values.
  const [pending, setPending] = useState<Record<string, "closing" | "modifying">>({});
  const setRowPending = (ticket: string, mode: "closing" | "modifying" | null) =>
    setPending((p) => {
      const next = { ...p };
      if (mode == null) delete next[ticket]; else next[ticket] = mode;
      return next;
    });

  const [modifyTarget, setModifyTarget] = useState<LivePosition | null>(null);
  const [closeTarget, setCloseTarget] = useState<LivePosition | null>(null);
  const [partialTarget, setPartialTarget] = useState<LivePosition | null>(null);
  const [bulkScope, setBulkScope] = useState<BulkScope | null>(null);

  const livePositions: LivePosition[] = rows.map((r) => ({
    ticket: r.ticket, symbol: r.symbol, side: r.side, volume: r.volume,
    entry_price: r.entry_price, current_price: r.live_price,
    stop_loss: r.stop_loss, take_profit: r.take_profit,
    net_profit: r.net_profit, profit: r.profit,
  }));

  const winners = livePositions.filter((p) => p.net_profit > 0).length;
  const losers = livePositions.filter((p) => p.net_profit < 0).length;

  if (rows.length === 0) {
    const profit = snap.accountProfit;
    const tol = profit == null ? 0 : Math.max(0.05, Math.abs(profit) * 0.005);
    const divergent = profit != null && Math.abs(profit) > tol;
    if (divergent) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded border border-[#FFCD05]/40 bg-[#FFCD05]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#FFCD05]">
            Reconciliación
          </span>
          <div className="text-sm text-neutral-200">
            El bróker reporta P&amp;L abierto {profit >= 0 ? "+" : ""}
            {profit.toFixed(2)} {snap.currency} pero no se recibieron posiciones.
          </div>
          <div className="max-w-md text-xs text-neutral-500">
            Diferencia con la barra de cuenta detectada. Puede ser una posición no entregada en este ciclo
            o una inconsistencia en el feed del bróker. Reintentando cada 5 s.
          </div>
          <button onClick={refresh} className="mt-1 rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-900">
            Reintentar ahora
          </button>
        </div>
      );
    }
    return <div className="px-3 py-10 text-center text-xs text-muted-foreground">Sin posiciones abiertas</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center justify-end gap-1 border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1">
        <Button size="sm" variant="ghost" className="h-6 text-[10px] uppercase tracking-wider"
          onClick={() => setBulkScope("winners")} disabled={winners === 0}>
          Cerrar ganadoras <span className="ml-1 text-emerald-400">{winners}</span>
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] uppercase tracking-wider"
          onClick={() => setBulkScope("losers")} disabled={losers === 0}>
          Cerrar perdedoras <span className="ml-1 text-red-400">{losers}</span>
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] uppercase tracking-wider text-red-300 hover:text-red-200"
          onClick={() => setBulkScope("all")} disabled={livePositions.length === 0}>
          Cerrar todo <span className="ml-1">{livePositions.length}</span>
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[1200px] text-[11px] font-mono">
          <thead className="sticky top-0 z-10 bg-[#0a0a0a]">
            <tr className="text-left text-[9px] uppercase tracking-[0.18em] text-neutral-500">
              <th className="px-3 py-2 font-normal">Símbolo</th>
              <th className="px-3 py-2 font-normal">Lado</th>
              <th className="px-3 py-2 font-normal text-right">Volumen</th>
              <th className="px-3 py-2 font-normal text-right">Entrada</th>
              <th className="px-3 py-2 font-normal text-right">Actual</th>
              <th className="px-3 py-2 font-normal text-right">SL</th>
              <th className="px-3 py-2 font-normal text-right">TP</th>
              <th className="px-3 py-2 font-normal text-right">P&L</th>
              <th className="px-3 py-2 font-normal text-right">Neto</th>
              <th className="px-3 py-2 font-normal text-right">Apertura</th>
              <th className="px-3 py-2 font-normal text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/70">
            {rows.map((r) => {
              const pnl = Number(r.profit) || 0;
              const net = Number(r.net_profit) || 0;
              const lp: LivePosition = {
                ticket: r.ticket, symbol: r.symbol, side: r.side, volume: r.volume,
                entry_price: r.entry_price, current_price: r.live_price,
                stop_loss: r.stop_loss, take_profit: r.take_profit,
                net_profit: r.net_profit, profit: r.profit,
              };
              const rowPending = pending[String(r.ticket)];
              return (
                <tr key={String(r.ticket)} className={cn("tabular-nums hover:bg-neutral-900/40", rowPending && "opacity-60")}>
                  <td className="px-3 py-1.5 font-bold text-neutral-100">{r.symbol}</td>
                  <td className="px-3 py-1.5">
                    <span className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      r.side === "buy" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                    )}>{r.side === "buy" ? "compra" : "venta"}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-neutral-200">{r.volume.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right text-neutral-400">{fmtPrice(r.symbol, r.entry_price)}</td>
                  <td className="px-3 py-1.5 text-right text-neutral-100">{fmtPrice(r.symbol, r.live_price)}</td>
                  <td className={cn("px-3 py-1.5 text-right", r.stop_loss ? "text-red-400/80" : "text-neutral-600")}>{fmtPrice(r.symbol, r.stop_loss)}</td>
                  <td className={cn("px-3 py-1.5 text-right", r.take_profit ? "text-emerald-400/80" : "text-neutral-600")}>{fmtPrice(r.symbol, r.take_profit)}</td>
                  <td className={cn("px-3 py-1.5 text-right font-bold",
                    pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-neutral-500")}>
                    {pnl === 0 ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-bold",
                    net > 0 ? "text-emerald-400" : net < 0 ? "text-red-400" : "text-neutral-500")}>
                    {net === 0 ? "—" : `${net >= 0 ? "+" : ""}${net.toFixed(2)}`}
                  </td>
                  <td className="px-3 py-1.5 text-right text-neutral-500">{fmtDateTime(r.time_open)}</td>
                  <td className="px-3 py-1.5">
                    {rowPending ? (
                      <span className="flex items-center justify-center gap-1 text-[10px] text-yellow-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {rowPending === "closing" ? "Cerrando…" : "Modificando…"}
                      </span>
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setModifyTarget(lp)}
                              className="p-1 rounded hover:bg-[#FFCD05]/15 hover:text-[#FFCD05] text-neutral-400">
                              <Pencil className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Modificar SL/TP</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setPartialTarget(lp)}
                              className="p-1 rounded hover:bg-orange-500/15 hover:text-orange-400 text-neutral-400">
                              <Slice className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Cierre parcial</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setCloseTarget(lp)}
                              className="p-1 rounded hover:bg-red-500/15 hover:text-red-400 text-neutral-400">
                              <XIcon className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Cerrar posición</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-neutral-800 bg-[#0a0a0a] px-3 py-1.5 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-3 text-neutral-500">
          <span>Total: {rows.length} posición{rows.length !== 1 ? "es" : ""}</span>
          {!reconcilesWithBar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-yellow-400">
                  <AlertTriangle className="h-3 w-3" /> Reconciliación
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] text-xs">
                Suma de P&L de filas ({totalGross.toFixed(2)}) no coincide con P&L abierto del bróker ({snap.accountProfit?.toFixed(2)}).
                Se mostrará el valor del bróker como autoridad en la próxima actualización.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="text-right leading-tight">
          <div className={cn("text-[12px] font-bold tabular-nums", totalNet >= 0 ? "text-emerald-400" : "text-red-400")}>
            Neto {totalNet >= 0 ? "+" : ""}{totalNet.toFixed(2)} {snap.currency}
          </div>
          <div className="text-[8px] uppercase tracking-[0.22em] text-neutral-500">
            Bruto {fmtMoney(totalGross, snap.currency)} · Bróker {snap.accountProfit != null ? fmtMoney(snap.accountProfit, snap.currency) : "—"}
          </div>
        </div>
      </div>

      <ModifyProtectionDialog
        open={modifyTarget != null} onOpenChange={(v) => !v && setModifyTarget(null)}
        position={modifyTarget} accountBalance={balance}
        onDone={() => { setRowPending(String(modifyTarget?.ticket ?? ""), null); refresh(); }}
      />
      <CloseConfirmDialog
        open={closeTarget != null} onOpenChange={(v) => !v && setCloseTarget(null)}
        position={closeTarget}
        onDone={() => { setRowPending(String(closeTarget?.ticket ?? ""), null); refresh(); }}
      />
      <PartialCloseDialog
        open={partialTarget != null} onOpenChange={(v) => !v && setPartialTarget(null)}
        position={partialTarget}
        onDone={() => { setRowPending(String(partialTarget?.ticket ?? ""), null); refresh(); }}
      />
      <BulkCloseDialog
        open={bulkScope != null} onOpenChange={(v) => !v && setBulkScope(null)}
        scope={bulkScope ?? "all"} positions={livePositions}
        onPerPositionPending={(ticket, isPending) => setRowPending(ticket, isPending ? "closing" : null)}
        onDone={refresh}
      />
    </div>
  );
}

/* ─────────── tab: pending orders ─────────── */

function OrdersTab({ snap, refresh }: { snap: SnapshotState; refresh: () => void }) {
  const symbols = useMemo(
    () => Array.from(new Set(snap.pendingOrders.map((o) => o.symbol))),
    [snap.pendingOrders],
  );
  const ticks = useMultiSymbolTicks(symbols);

  // Cancel re-poll state: tickets in "Cancelando…" until snapshot confirms
  // their removal or the re-poll budget expires.
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const [unconfirmed, setUnconfirmed] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<PendingOrderLite | null>(null);

  if (snap.pendingOrders.length === 0) {
    return <div className="px-3 py-10 text-center text-xs text-muted-foreground">Sin órdenes pendientes</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[1100px] text-[11px] font-mono">
        <thead className="sticky top-0 z-10 bg-[#0a0a0a]">
          <tr className="text-left text-[9px] uppercase tracking-[0.18em] text-neutral-500">
            <th className="px-3 py-2 font-normal">Símbolo</th>
            <th className="px-3 py-2 font-normal">Tipo</th>
            <th className="px-3 py-2 font-normal">Lado</th>
            <th className="px-3 py-2 font-normal text-right">Volumen</th>
            <th className="px-3 py-2 font-normal text-right">Precio</th>
            <th className="px-3 py-2 font-normal text-right">Mercado</th>
            <th className="px-3 py-2 font-normal text-right">Distancia (pips)</th>
            <th className="px-3 py-2 font-normal text-right">SL</th>
            <th className="px-3 py-2 font-normal text-right">TP</th>
            <th className="px-3 py-2 font-normal">Duración</th>
            <th className="px-3 py-2 font-normal text-right">Colocada</th>
            <th className="px-3 py-2 font-normal text-center">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/70">
          {snap.pendingOrders.map((o) => {
            const t = ticks[o.symbol];
            const ref = o.side === "buy" ? (t?.ask ?? o.price_current) : (t?.bid ?? o.price_current);
            const ps = pipSizeFor(t?.digits ?? null);
            const distPips = ref && o.price_open && ps > 0 ? (o.price_open - ref) / ps : null;
            const typeEs = o.orderType === "limit" ? "Límite" : o.orderType === "stop" ? "Stop" : o.orderType === "stop_limit" ? "Stop-Lím." : o.orderType;
            const tStr = String(o.ticket);
            const isCancelling = cancelling.has(tStr);
            const isUnconfirmed = unconfirmed.has(tStr);
            return (
              <tr key={tStr} className={cn("tabular-nums hover:bg-neutral-900/40", isCancelling && "opacity-60")}>
                <td className="px-3 py-1.5 font-bold text-neutral-100">{o.symbol}</td>
                <td className="px-3 py-1.5 text-neutral-300">{typeEs}</td>
                <td className="px-3 py-1.5">
                  <span className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    o.side === "buy" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                  )}>{o.side === "buy" ? "compra" : "venta"}</span>
                </td>
                <td className="px-3 py-1.5 text-right text-neutral-200">{o.volume.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right text-neutral-100">{fmtPrice(o.symbol, o.price_open)}</td>
                <td className="px-3 py-1.5 text-right text-neutral-400">{fmtPrice(o.symbol, ref)}</td>
                <td className={cn("px-3 py-1.5 text-right",
                  distPips == null ? "text-neutral-600" : distPips > 0 ? "text-emerald-400/80" : "text-red-400/80")}>
                  {distPips == null ? "—" : `${distPips > 0 ? "+" : ""}${distPips.toFixed(1)}`}
                </td>
                <td className={cn("px-3 py-1.5 text-right", o.stop_loss ? "text-red-400/80" : "text-neutral-600")}>{fmtPrice(o.symbol, o.stop_loss)}</td>
                <td className={cn("px-3 py-1.5 text-right", o.take_profit ? "text-emerald-400/80" : "text-neutral-600")}>{fmtPrice(o.symbol, o.take_profit)}</td>
                <td className="px-3 py-1.5 text-neutral-300">{o.duration}</td>
                <td className="px-3 py-1.5 text-right text-neutral-500">{fmtDateTime(o.time_setup)}</td>
                <td className="px-3 py-1.5 text-center">
                  {isCancelling ? (
                    <span className="flex items-center justify-center gap-1 text-[10px] text-yellow-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Cancelando…
                    </span>
                  ) : isUnconfirmed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center justify-center gap-1 text-[10px] text-red-400">
                          <AlertTriangle className="h-3 w-3" /> No confirmado
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px] text-xs">
                        La cancelación no se confirmó en las últimas consultas. Verifica el estado en MT5 o reintenta.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => setCancelTarget({
                          ticket: o.ticket, symbol: o.symbol, orderType: typeEs,
                          side: o.side, volume: o.volume, price_open: o.price_open,
                        })}
                          className="p-1 rounded hover:bg-red-500/15 hover:text-red-400 text-neutral-400">
                          <XIcon className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Cancelar orden</TooltipContent>
                    </Tooltip>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <CancelOrderConfirmDialog
        open={cancelTarget != null}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        order={cancelTarget}
        onCancelling={(ticket) => setCancelling((s) => new Set(s).add(ticket))}
        onConfirmed={(ticket) => {
          setCancelling((s) => { const n = new Set(s); n.delete(ticket); return n; });
          setUnconfirmed((s) => { const n = new Set(s); n.delete(ticket); return n; });
          refresh();
        }}
        onUnconfirmed={(ticket) => {
          setCancelling((s) => { const n = new Set(s); n.delete(ticket); return n; });
          setUnconfirmed((s) => new Set(s).add(ticket));
          refresh();
        }}
      />
    </div>
  );
}

/* ─────────── tab: history ─────────── */

type HistKind = "orders" | "deals";

interface HistState {
  loading: boolean;
  error: string | null;
  data: any[];
  meta: { limit: number; offset: number; count: number; hasMore: boolean };
}

function useHistory(kind: HistKind, dateFrom: string, dateTo: string, symbol: string, offset: number, limit: number) {
  const [state, setState] = useState<HistState>({
    loading: true, error: null, data: [], meta: { limit, offset: 0, count: 0, hasMore: false },
  });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mt5-history", {
          body: { kind, dateFrom, dateTo, symbol: symbol || undefined, limit, offset },
        });
        if (cancelled) return;
        if (error) { setState({ loading: false, error: error.message, data: [], meta: { limit, offset, count: 0, hasMore: false } }); return; }
        if (!data?.success) { setState({ loading: false, error: data?.error ?? "Sin datos", data: [], meta: { limit, offset, count: 0, hasMore: false } }); return; }
        setState({ loading: false, error: null, data: data.data ?? [], meta: data.meta });
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, error: e?.message ?? "Network error", data: [], meta: { limit, offset, count: 0, hasMore: false } });
      }
    })();
    return () => { cancelled = true; };
  }, [kind, dateFrom, dateTo, symbol, offset, limit]);
  return state;
}

function isoDateOnly(d: Date) { return d.toISOString().slice(0, 10); }

function HistoryTab() {
  const [subTab, setSubTab] = useState<HistKind>("deals");
  const [fromDate, setFromDate] = useState<string>(() => isoDateOnly(new Date(Date.now() - 7 * 86_400_000)));
  const [toDate, setToDate] = useState<string>(() => isoDateOnly(new Date()));
  const [symbol, setSymbol] = useState<string>("");
  const [offset, setOffset] = useState<number>(0);
  const limit = 50;
  const safeFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : isoDateOnly(new Date(Date.now() - 7 * 86_400_000));
  const safeTo = /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : isoDateOnly(new Date());
  const dFrom = new Date(`${safeFrom}T00:00:00Z`);
  const dTo = new Date(`${safeTo}T23:59:59Z`);
  const dateFromIso = Number.isFinite(dFrom.getTime()) ? dFrom.toISOString() : new Date(Date.now() - 7 * 86_400_000).toISOString();
  const dateToIso = Number.isFinite(dTo.getTime()) ? dTo.toISOString() : new Date().toISOString();
  const hist = useHistory(subTab, dateFromIso, dateToIso, symbol.toUpperCase(), offset, limit);

  useEffect(() => { setOffset(0); }, [subTab, fromDate, toDate, symbol]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-[#0a0a0a] px-3 py-2">
        <div className="flex items-center gap-1 rounded border border-neutral-800 bg-neutral-950 p-0.5">
          <button onClick={() => setSubTab("deals")} className={cn(
            "px-2 py-1 text-[10px] uppercase tracking-wider rounded",
            subTab === "deals" ? "bg-[#FFCD05]/15 text-[#FFCD05]" : "text-neutral-400 hover:text-neutral-200")}>
            Operaciones
          </button>
          <button onClick={() => setSubTab("orders")} className={cn(
            "px-2 py-1 text-[10px] uppercase tracking-wider rounded",
            subTab === "orders" ? "bg-[#FFCD05]/15 text-[#FFCD05]" : "text-neutral-400 hover:text-neutral-200")}>
            Órdenes
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Desde</span>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-7 w-[130px] text-xs" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Hasta</span>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-7 w-[130px] text-xs" />
        </div>
        <Input placeholder="Símbolo (opcional)" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="h-7 w-[150px] text-xs uppercase" />
      </div>

      <div className="flex-1 overflow-auto">
        {hist.loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : hist.error ? (
          <div className="px-3 py-10 text-center text-xs text-yellow-400">
            {hist.error}
          </div>
        ) : hist.data.length === 0 ? (
          <div className="px-3 py-10 text-center text-xs text-muted-foreground">
            Aún no hay operaciones en este rango
          </div>
        ) : subTab === "deals" ? (
          <DealsTable rows={hist.data} />
        ) : (
          <OrdersHistoryTable rows={hist.data} />
        )}
      </div>

      <div className="shrink-0 flex items-center justify-between border-t border-neutral-800 bg-[#0a0a0a] px-3 py-1.5 text-[10px] font-mono text-neutral-500">
        <span>
          {hist.meta.count > 0
            ? `Mostrando ${hist.meta.offset + 1}–${hist.meta.offset + hist.meta.count}`
            : "Sin resultados"}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))} className="h-6 text-[10px]">
            Anterior
          </Button>
          <Button size="sm" variant="ghost" disabled={!hist.meta.hasMore}
            onClick={() => setOffset(offset + limit)} className="h-6 text-[10px]">
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

function DealsTable({ rows }: { rows: any[] }) {
  const totalNet = rows.reduce((s, r) => s + (Number(r.profit) || 0) + (Number(r.swap) || 0) + (Number(r.commission) || 0) + (Number(r.fee) || 0), 0);
  return (
    <>
      <table className="w-full min-w-[1100px] text-[11px] font-mono">
        <thead className="sticky top-0 bg-[#0a0a0a]">
          <tr className="text-left text-[9px] uppercase tracking-[0.18em] text-neutral-500">
            <th className="px-3 py-2 font-normal">Hora</th>
            <th className="px-3 py-2 font-normal">Ticket</th>
            <th className="px-3 py-2 font-normal">Símbolo</th>
            <th className="px-3 py-2 font-normal">Tipo</th>
            <th className="px-3 py-2 font-normal text-right">Volumen</th>
            <th className="px-3 py-2 font-normal text-right">Precio</th>
            <th className="px-3 py-2 font-normal text-right">P&L</th>
            <th className="px-3 py-2 font-normal text-right">Swap</th>
            <th className="px-3 py-2 font-normal text-right">Comisión</th>
            <th className="px-3 py-2 font-normal text-right">Neto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/70">
          {rows.map((d) => {
            const profit = Number(d.profit) || 0;
            const swap = Number(d.swap) || 0;
            const commission = Number(d.commission) || 0;
            const fee = Number(d.fee) || 0;
            const net = profit + swap + commission + fee;
            const typeEs = d.type === 0 ? "compra" : d.type === 1 ? "venta" : "balance";
            return (
              <tr key={String(d.ticket)} className="tabular-nums hover:bg-neutral-900/40">
                <td className="px-3 py-1.5 text-neutral-500">{fmtDateTime(d.time)}</td>
                <td className="px-3 py-1.5 text-neutral-400">{d.ticket}</td>
                <td className="px-3 py-1.5 font-bold text-neutral-100">{d.symbol}</td>
                <td className="px-3 py-1.5 text-neutral-300">{typeEs}</td>
                <td className="px-3 py-1.5 text-right text-neutral-200">{Number(d.volume).toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right text-neutral-100">{fmtPrice(d.symbol, d.price)}</td>
                <td className={cn("px-3 py-1.5 text-right",
                  profit > 0 ? "text-emerald-400" : profit < 0 ? "text-red-400" : "text-neutral-500")}>
                  {profit === 0 ? "—" : `${profit >= 0 ? "+" : ""}${profit.toFixed(2)}`}
                </td>
                <td className="px-3 py-1.5 text-right text-neutral-400">{swap === 0 ? "—" : swap.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right text-neutral-400">{commission === 0 ? "—" : commission.toFixed(2)}</td>
                <td className={cn("px-3 py-1.5 text-right font-bold",
                  net > 0 ? "text-emerald-400" : net < 0 ? "text-red-400" : "text-neutral-500")}>
                  {net === 0 ? "—" : `${net >= 0 ? "+" : ""}${net.toFixed(2)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-800 bg-[#0a0a0a]">
            <td colSpan={9} className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-neutral-500">
              Total neto (esta página)
            </td>
            <td className={cn("px-3 py-2 text-right font-bold tabular-nums",
              totalNet >= 0 ? "text-emerald-400" : "text-red-400")}>
              {totalNet >= 0 ? "+" : ""}{totalNet.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

function OrdersHistoryTable({ rows }: { rows: any[] }) {
  const stateLabel: Record<number, string> = {
    0: "Iniciada", 1: "Colocada", 2: "Cancelada", 3: "Parcial", 4: "Ejecutada", 5: "Rechazada", 6: "Expirada",
  };
  const typeLabel: Record<number, string> = {
    0: "Compra mercado", 1: "Venta mercado", 2: "Buy Limit", 3: "Sell Limit",
    4: "Buy Stop", 5: "Sell Stop", 6: "Buy Stop Lim.", 7: "Sell Stop Lim.",
  };
  return (
    <table className="w-full min-w-[1000px] text-[11px] font-mono">
      <thead className="sticky top-0 bg-[#0a0a0a]">
        <tr className="text-left text-[9px] uppercase tracking-[0.18em] text-neutral-500">
          <th className="px-3 py-2 font-normal">Colocada</th>
          <th className="px-3 py-2 font-normal">Cerrada</th>
          <th className="px-3 py-2 font-normal">Ticket</th>
          <th className="px-3 py-2 font-normal">Símbolo</th>
          <th className="px-3 py-2 font-normal">Tipo</th>
          <th className="px-3 py-2 font-normal text-right">Vol. inicial</th>
          <th className="px-3 py-2 font-normal text-right">Vol. restante</th>
          <th className="px-3 py-2 font-normal text-right">Precio</th>
          <th className="px-3 py-2 font-normal">Estado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-900/70">
        {rows.map((o) => (
          <tr key={String(o.ticket)} className="tabular-nums hover:bg-neutral-900/40">
            <td className="px-3 py-1.5 text-neutral-500">{fmtDateTime(o.time_setup)}</td>
            <td className="px-3 py-1.5 text-neutral-500">{fmtDateTime(o.time_done)}</td>
            <td className="px-3 py-1.5 text-neutral-400">{o.ticket}</td>
            <td className="px-3 py-1.5 font-bold text-neutral-100">{o.symbol}</td>
            <td className="px-3 py-1.5 text-neutral-300">{typeLabel[Number(o.type)] ?? `Tipo ${o.type}`}</td>
            <td className="px-3 py-1.5 text-right text-neutral-200">{Number(o.volume_initial).toFixed(2)}</td>
            <td className="px-3 py-1.5 text-right text-neutral-400">{Number(o.volume_current).toFixed(2)}</td>
            <td className="px-3 py-1.5 text-right text-neutral-100">{fmtPrice(o.symbol, o.price_open || o.price_current)}</td>
            <td className="px-3 py-1.5 text-neutral-300">{stateLabel[Number(o.state)] ?? `Estado ${o.state}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─────────── shell ─────────── */

export default function PositionsOrdersHistoryPanel() {
  const snap = usePositionsAndOrdersSnapshot();
  const stale = snap.staleCount >= 2;

  return (
    <div className="flex h-full flex-col bg-[#0c0c0c] text-neutral-100">
      <Tabs defaultValue="posiciones" className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2">
          <TabsList className="h-8 bg-transparent p-0 gap-0">
            <TabsTrigger value="posiciones" className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-[#FFCD05] data-[state=active]:bg-transparent data-[state=active]:text-[#FFCD05] text-[10px] uppercase tracking-wider px-3">
              Posiciones <span className="ml-1.5 text-neutral-500">{snap.positions.length}</span>
            </TabsTrigger>
            <TabsTrigger value="ordenes" className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-[#FFCD05] data-[state=active]:bg-transparent data-[state=active]:text-[#FFCD05] text-[10px] uppercase tracking-wider px-3">
              Órdenes <span className="ml-1.5 text-neutral-500">{snap.pendingOrders.length}</span>
            </TabsTrigger>
            <TabsTrigger value="historial" className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-[#FFCD05] data-[state=active]:bg-transparent data-[state=active]:text-[#FFCD05] text-[10px] uppercase tracking-wider px-3">
              Historial
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 pr-1">
            {stale && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-yellow-400">
                    <AlertTriangle className="h-3 w-3" /> Sin señal
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px] text-xs">
                  No hemos podido actualizar las posiciones desde el bróker en las últimas consultas. Mostrando última instantánea conocida.
                </TooltipContent>
              </Tooltip>
            )}
            <button onClick={snap.refresh}
              className="flex h-6 w-6 items-center justify-center rounded-sm border border-neutral-800 text-neutral-400 hover:text-[#FFCD05] hover:border-[#FFCD05]/40 transition-colors">
              <RefreshCw className={cn("h-3 w-3", snap.loading && "animate-spin")} />
            </button>
          </div>
        </div>

        <TabsContent value="posiciones" className="mt-0 flex-1 min-h-0">
          {snap.loading && snap.positions.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando posiciones…
            </div>
          ) : !snap.connected ? (
            <div className="px-3 py-10 text-center text-xs text-muted-foreground">
              Conecta tu cuenta MT5 para ver posiciones.
            </div>
          ) : (
            <PositionsTab snap={snap} refresh={snap.refresh} balance={snap.balance} />
          )}
        </TabsContent>
        <TabsContent value="ordenes" className="mt-0 flex-1 min-h-0">
          {snap.loading && snap.pendingOrders.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando órdenes…
            </div>
          ) : !snap.connected ? (
            <div className="px-3 py-10 text-center text-xs text-muted-foreground">
              Conecta tu cuenta MT5 para ver órdenes.
            </div>
          ) : (
            <OrdersTab snap={snap} refresh={snap.refresh} />
          )}
        </TabsContent>
        <TabsContent value="historial" className="mt-0 flex-1 min-h-0">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
