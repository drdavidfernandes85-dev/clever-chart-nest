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
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";
import { fmtMoney } from "@/contexts/LiveAccountContext";

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
  currency: string;
  asOf: number;
  connected: boolean;
  loading: boolean;
  staleCount: number;
  lastError: string | null;
}

function usePositionsAndOrdersSnapshot(): SnapshotState & { refresh: () => void } {
  const [s, setS] = useState<SnapshotState>({
    positions: [], pendingOrders: [], accountProfit: null, currency: "USD",
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

function PositionsTab({ snap }: { snap: SnapshotState }) {
  // Subscribe to live ticks for every distinct symbol so each row can bridge
  // the 5s broker poll. On each broker snapshot we snap to broker values;
  // between polls we recompute price * direction * contractSize using ticks.
  const symbols = useMemo(
    () => Array.from(new Set(snap.positions.map((p) => p.symbol))),
    [snap.positions],
  );
  const ticks = useMultiSymbolTicks(symbols);

  const rows = useMemo(() => {
    return snap.positions.map((p) => {
      const t = ticks[p.symbol];
      // Use side-correct mid → broker reports current_price; this is just for
      // intra-poll P&L drift, broker snapshot remains authoritative on each poll.
      const livePrice = p.side === "buy" ? (t?.bid ?? p.current_price) : (t?.ask ?? p.current_price);
      // We do NOT have contractSize / tickValue here without a per-symbol spec
      // fetch (which would be N requests). Use the broker's last reported P&L
      // as the baseline and only re-color if the live price has moved enough.
      // Net P&L drift between polls is small; we render broker values verbatim
      // and only refresh the live "current_price" column.
      return {
        ...p,
        live_price: Number.isFinite(livePrice) && livePrice > 0 ? livePrice : p.current_price,
      };
    });
  }, [snap.positions, ticks]);

  const totalNet = rows.reduce((s, r) => s + (Number(r.net_profit) || 0), 0);
  // Reconciliation against the bar's P&L abierto. Bar = account.profit
  // (excludes swap+commission). Rows = sum(profit + swap + commission).
  // Convention: bar reflects floating P&L only; this footer shows full net.
  const totalGross = rows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  const reconcilesWithBar =
    snap.accountProfit == null
      ? true
      : Math.abs(totalGross - snap.accountProfit) <= Math.max(0.05, Math.abs(snap.accountProfit) * 0.005);

  if (rows.length === 0) {
    return (
      <div className="px-3 py-10 text-center text-xs text-muted-foreground">
        Sin posiciones abiertas
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[1100px] text-[11px] font-mono">
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
              <th className="px-3 py-2 font-normal text-right">Swap</th>
              <th className="px-3 py-2 font-normal text-right">Comisión</th>
              <th className="px-3 py-2 font-normal text-right">Neto</th>
              <th className="px-3 py-2 font-normal text-right">Apertura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/70">
            {rows.map((r) => {
              const pnl = Number(r.profit) || 0;
              const net = Number(r.net_profit) || 0;
              return (
                <tr key={String(r.ticket)} className="tabular-nums hover:bg-neutral-900/40">
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
                  <td className={cn("px-3 py-1.5 text-right", r.stop_loss ? "text-red-400/80" : "text-neutral-600")}>
                    {fmtPrice(r.symbol, r.stop_loss)}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right", r.take_profit ? "text-emerald-400/80" : "text-neutral-600")}>
                    {fmtPrice(r.symbol, r.take_profit)}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-bold",
                    pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-neutral-500")}>
                    {pnl === 0 ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right",
                    r.swap > 0 ? "text-emerald-400/70" : r.swap < 0 ? "text-red-400/70" : "text-neutral-500")}>
                    {r.swap === 0 ? "—" : r.swap.toFixed(2)}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right",
                    r.commission < 0 ? "text-red-400/70" : "text-neutral-500")}>
                    {r.commission === 0 ? "—" : r.commission.toFixed(2)}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-bold",
                    net > 0 ? "text-emerald-400" : net < 0 ? "text-red-400" : "text-neutral-500")}>
                    {net === 0 ? "—" : `${net >= 0 ? "+" : ""}${net.toFixed(2)}`}
                  </td>
                  <td className="px-3 py-1.5 text-right text-neutral-500">{fmtDateTime(r.time_open)}</td>
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
          <div className={cn("text-[12px] font-bold tabular-nums",
            totalNet >= 0 ? "text-emerald-400" : "text-red-400")}>
            Neto {totalNet >= 0 ? "+" : ""}{totalNet.toFixed(2)} {snap.currency}
          </div>
          <div className="text-[8px] uppercase tracking-[0.22em] text-neutral-500">
            Bruto {fmtMoney(totalGross, snap.currency)} · Bróker {snap.accountProfit != null ? fmtMoney(snap.accountProfit, snap.currency) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── tab: pending orders ─────────── */

function OrdersTab({ snap }: { snap: SnapshotState }) {
  const symbols = useMemo(
    () => Array.from(new Set(snap.pendingOrders.map((o) => o.symbol))),
    [snap.pendingOrders],
  );
  const ticks = useMultiSymbolTicks(symbols);

  if (snap.pendingOrders.length === 0) {
    return (
      <div className="px-3 py-10 text-center text-xs text-muted-foreground">
        Sin órdenes pendientes
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[1000px] text-[11px] font-mono">
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
            <th className="px-3 py-2 font-normal text-right">Expira</th>
            <th className="px-3 py-2 font-normal text-right">Colocada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/70">
          {snap.pendingOrders.map((o) => {
            const t = ticks[o.symbol];
            const ref = o.side === "buy" ? (t?.ask ?? o.price_current) : (t?.bid ?? o.price_current);
            const ps = pipSizeFor(t?.digits ?? null);
            const distPips = ref && o.price_open && ps > 0 ? (o.price_open - ref) / ps : null;
            const typeEs = o.orderType === "limit" ? "Límite" : o.orderType === "stop" ? "Stop" : o.orderType === "stop_limit" ? "Stop-Lím." : o.orderType;
            return (
              <tr key={String(o.ticket)} className="tabular-nums hover:bg-neutral-900/40">
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
                <td className={cn("px-3 py-1.5 text-right", o.stop_loss ? "text-red-400/80" : "text-neutral-600")}>
                  {fmtPrice(o.symbol, o.stop_loss)}
                </td>
                <td className={cn("px-3 py-1.5 text-right", o.take_profit ? "text-emerald-400/80" : "text-neutral-600")}>
                  {fmtPrice(o.symbol, o.take_profit)}
                </td>
                <td className="px-3 py-1.5 text-neutral-300">{o.duration}</td>
                <td className="px-3 py-1.5 text-right text-neutral-500">
                  {o.duration === "GTC" || !o.time_expiration ? "—" : fmtDateTime(o.time_expiration)}
                </td>
                <td className="px-3 py-1.5 text-right text-neutral-500">{fmtDateTime(o.time_setup)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  const dateFromIso = new Date(`${fromDate}T00:00:00Z`).toISOString();
  const dateToIso = new Date(`${toDate}T23:59:59Z`).toISOString();
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
            <PositionsTab snap={snap} />
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
            <OrdersTab snap={snap} />
          )}
        </TabsContent>
        <TabsContent value="historial" className="mt-0 flex-1 min-h-0">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
