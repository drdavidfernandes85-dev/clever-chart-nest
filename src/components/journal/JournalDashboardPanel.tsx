import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, TrendingDown, Target, Activity, BarChart3, Hash, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";

export interface Position {
  user_id: string | null;
  mt_login: number | null;
  position_id: number | null;
  symbol: string | null;
  side: string | null;
  open_time: string | null;
  close_time: string | null;
  volume_in: number | null;
  volume_out: number | null;
  vwap_open: number | null;
  vwap_close: number | null;
  net_pnl: number | null;
  gross_profit: number | null;
  swap_total: number | null;
  commission_total: number | null;
  fee_total: number | null;
  deal_count: number | null;
  is_closed: boolean | null;
  has_complex_entry: boolean | null;
}

interface AuditTicketRow { ticket: string | null }
interface DealKeyRow { position_id: number | null; order_id: number | null }

const fmtMoney = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-419", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; }
};

// Price-reconstruction uses the live broker spec (contract size + profit
// currency) fetched per-symbol from get-mt5-terminal-data and cached for the
// session. We never fall back to a hardcoded table — if the spec is missing,
// the row stays as a dash. Eligibility is purely:
//   spec.currencyProfit === accountCurrency  (no FX conversion in derivation).
export interface LiveSpec {
  contractSize: number;
  profitCcy: string;
  digits: number;
  /** point = 10^-digits when broker omits it; only used for the pips tooltip. */
  point: number;
}

type Reconstruction =
  | { kind: "ok"; close: number; pips: number; digits: number }
  | { kind: "no_spec" }
  | { kind: "ccy_mismatch"; profitCcy: string }
  | { kind: "tripwire" };

/**
 * Derive the real close from price P&L alone.
 *   numerator = position.gross_profit  ← view sum(deal.profit), NEVER includes
 *   swap/commission/fee (those live in swap_total / commission_total / fee_total
 *   on the position and in net_pnl as the post-fees figure).
 *   close = vwap_open ± gross_profit / (volume_out × spec.contractSize)
 *           sign +buy / −sell.
 * Exported for unit testing against synthetic fee-bearing deals.
 */
export function reconstructClose(
  p: Position,
  spec: LiveSpec | null,
  accountCcy: string,
): Reconstruction {
  if (!spec) return { kind: "no_spec" };
  if (spec.profitCcy !== accountCcy) return { kind: "ccy_mismatch", profitCcy: spec.profitCcy };
  const vol = p.volume_out ?? p.volume_in ?? 0;
  // Numerator is price-P&L only. Do NOT add swap_total/commission_total/fee_total.
  const profit = p.gross_profit;
  const open = p.vwap_open;
  if (!vol || open == null || profit == null || profit === 0) return { kind: "tripwire" };
  const sign = p.side === "buy" ? 1 : p.side === "sell" ? -1 : 0;
  if (!sign) return { kind: "tripwire" };
  const close = open + sign * (profit / (vol * spec.contractSize));
  if (Math.abs(close - open) < 1e-9) return { kind: "tripwire" };
  return {
    kind: "ok",
    close: Number(close.toFixed(spec.digits + 2)),
    pips: (close - open) / Math.max(spec.point, 1e-12),
    digits: spec.digits,
  };
}


const JournalDashboardPanel = () => {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [auditTickets, setAuditTickets] = useState<Set<string>>(new Set());
  const [positionOrders, setPositionOrders] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ chunk: number; deals: number } | null>(null);
  const [cancelRef] = useState<{ current: boolean }>({ current: false });
  const [specCache, setSpecCache] = useState<Map<string, LiveSpec | null>>(new Map());
  const [accountCurrency, setAccountCurrency] = useState<string>("USD");
  const [lastSync, setLastSync] = useState<string | null>(null);


  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [posRes, auditRes, stateRes, dealsRes] = await Promise.all([
      supabase
        .from("journal_positions")
        .select("*")
        .eq("user_id", user.id)
        .order("open_time", { ascending: false })
        .limit(500),
      supabase
        .from("execution_audit_events")
        .select("ticket")
        .eq("user_id", user.id),
      supabase
        .from("journal_sync_state")
        .select("last_synced_at, last_status, deals_total")
        .eq("user_id", user.id)
        .order("last_synced_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("journal_deals")
        .select("position_id, order_id")
        .eq("user_id", user.id)
        .not("position_id", "is", null),
    ]);
    setPositions((posRes.data ?? []) as Position[]);
    setAuditTickets(new Set(((auditRes.data ?? []) as AuditTicketRow[]).map((r) => String(r.ticket)).filter(Boolean)));
    const map = new Map<string, Set<string>>();
    for (const d of (dealsRes.data ?? []) as DealKeyRow[]) {
      if (d.position_id == null || d.order_id == null) continue;
      const key = String(d.position_id);
      let s = map.get(key);
      if (!s) { s = new Set(); map.set(key, s); }
      s.add(String(d.order_id));
    }
    setPositionOrders(map);
    setLastSync(stateRes.data?.last_synced_at ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Resolve account currency (drives reconstruction eligibility).
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_mt_accounts")
        .select("currency")
        .eq("user_id", user.id)
        .not("currency", "is", null)
        .limit(1)
        .maybeSingle();
      if (data?.currency) setAccountCurrency(String(data.currency).toUpperCase());
    })();
  }, [user]);

  // Fetch live broker spec for each distinct symbol that needs reconstruction.
  // Cached for the session; never re-fetched, never replaced by a hardcoded map.
  useEffect(() => {
    const symbols = Array.from(new Set(
      positions
        .filter((p) =>
          p.is_closed && p.symbol &&
          p.vwap_open != null && p.vwap_close != null &&
          Math.abs((p.vwap_open ?? 0) - (p.vwap_close ?? 0)) < 1e-9 &&
          Math.abs(p.net_pnl ?? 0) > 0.0001,
        )
        .map((p) => p.symbol!.toUpperCase()),
    ));
    const missing = symbols.filter((s) => !specCache.has(s));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(missing.map(async (sym) => {
        try {
          const { data, error } = await supabase.functions.invoke(
            "get-mt5-terminal-data", { body: { selectedSymbol: sym } },
          );
          if (error || !data?.success) return [sym, null] as const;
          const s = data.specs;
          if (!s || s.contractSize == null || !s.currencyProfit) return [sym, null] as const;
          const digits = s.digits ?? 5;
          const spec: LiveSpec = {
            contractSize: Number(s.contractSize),
            profitCcy: String(s.currencyProfit).toUpperCase(),
            digits,
            point: s.point ?? Math.pow(10, -digits),
          };
          return [sym, spec] as const;
        } catch { return [sym, null] as const; }
      }));
      if (cancelled) return;
      setSpecCache((prev) => {
        const next = new Map(prev);
        for (const [sym, spec] of results) next.set(sym, spec);
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [positions, specCache]);


  const sync = async () => {
    setSyncing(true);
    cancelRef.current = false;
    setSyncProgress({ chunk: 0, deals: 0 });
    const MAX_CHUNKS = 30;
    const t0 = performance.now();
    let totalDeals = 0;
    let dateTo: string | undefined;
    let lastErr: string | null = null;
    try {
      for (let i = 0; i < MAX_CHUNKS; i++) {
        if (cancelRef.current) break;
        const { data, error } = await supabase.functions.invoke("journal-sync", {
          body: { full: true, ...(dateTo ? { dateTo } : {}) },
        });
        if (error) { lastErr = error.message; break; }
        if (data?.error) { lastErr = data.error; break; }
        totalDeals += Number(data?.dealsFetched ?? 0);
        setSyncProgress({ chunk: i + 1, deals: totalDeals });
        if (!data?.hasMore || !data?.nextDateTo) break;
        dateTo = data.nextDateTo;
      }
      const wallSec = ((performance.now() - t0) / 1000).toFixed(1);
      if (lastErr) toast.error(`Sincronización: ${lastErr}`);
      else if (cancelRef.current) toast.info(`Cancelada · ${totalDeals} deals · ${wallSec}s`);
      else toast.success(`Sincronización completa · ${totalDeals} deals · ${wallSec}s`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error de sincronización");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
      cancelRef.current = false;
    }
  };
  const cancelSync = () => { cancelRef.current = true; };


  const closed = useMemo(() => positions.filter((p) => p.is_closed), [positions]);

  // PRICE RECONSTRUCTION (replaces dash-only render)
  // For positions whose TL out-deal price is provably stamped with the open
  // price (vwap_open == vwap_close with non-zero P&L), derive the real close
  // from profit when the symbol's profit currency matches the account currency:
  //   close = open ± profit / (volume × contractSize),  sign + for buy, − for sell.
  // Raw TL values in journal_deals are NEVER overwritten — derivation is render-
  // only. The integrity guard still trips on sign-impossible KPI outputs.
  const PRICE_EPS = 1e-9;
  type Aug = Position & { _recon?: Reconstruction; _needsRecon: boolean };
  const augmented: Aug[] = useMemo(() => closed.map((p) => {
    const needs =
      p.vwap_open != null && p.vwap_close != null &&
      Math.abs((p.vwap_open ?? 0) - (p.vwap_close ?? 0)) < PRICE_EPS &&
      Math.abs(p.net_pnl ?? 0) > 0.0001;
    const spec = needs && p.symbol ? specCache.get(p.symbol.toUpperCase()) ?? null : null;
    return { ...p, _needsRecon: needs, _recon: needs ? reconstructClose(p, spec, accountCurrency) : undefined };
  }), [closed, specCache, accountCurrency]);


  const reconstructed = augmented.filter((p) => p._recon?.kind === "ok");
  const unrecoverable = augmented.filter((p) => p._needsRecon && p._recon?.kind !== "ok");

  // Trusted set for KPIs: clean rows + rows reconstructed exactly.
  // Unrecoverable rows (ccy mismatch / tripwire) stay excluded — same posture as before.
  const trusted = useMemo(
    () => augmented.filter((p) => !p._needsRecon || p._recon?.kind === "ok"),
    [augmented],
  );

  const stats = useMemo(() => {
    if (trusted.length === 0) {
      return { totalPnl: 0, winRate: 0, profitFactor: 0, count: 0, best: 0, worst: 0, avgWin: 0, avgLoss: 0, volume: 0 };
    }
    const wins = trusted.filter((p) => (p.net_pnl ?? 0) > 0);
    const losses = trusted.filter((p) => (p.net_pnl ?? 0) < 0);
    const totalPnl = trusted.reduce((s, p) => s + (p.net_pnl ?? 0), 0);
    const grossWin = wins.reduce((s, p) => s + (p.net_pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + (p.net_pnl ?? 0), 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const best = trusted.reduce((m, p) => Math.max(m, p.net_pnl ?? 0), -Infinity);
    const worst = trusted.reduce((m, p) => Math.min(m, p.net_pnl ?? 0), Infinity);
    return {
      totalPnl,
      winRate: (wins.length / trusted.length) * 100,
      profitFactor: pf,
      count: trusted.length,
      best,
      worst,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      volume: trusted.reduce((s, p) => s + (p.volume_in ?? 0), 0),
    };
  }, [trusted]);

  const signBreach = stats.avgWin < 0 || stats.avgLoss < 0;
  const suppressKpis = signBreach;

  const fmtPF = (v: number) => (v === Infinity ? "∞" : v.toFixed(2));

  const kpis = [
    { label: "P&L Neto Total", value: fmtMoney(stats.totalPnl), Icon: stats.totalPnl >= 0 ? TrendingUp : TrendingDown,
      cls: stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Tasa de Aciertos", value: `${stats.winRate.toFixed(1)}%`, Icon: Target, cls: "text-primary" },
    { label: "Profit Factor", value: fmtPF(stats.profitFactor), Icon: BarChart3,
      cls: stats.profitFactor >= 1.5 ? "text-emerald-400" : stats.profitFactor >= 1 ? "text-primary" : "text-red-400" },
    { label: "Operaciones", value: String(stats.count), Icon: Hash, cls: "text-foreground" },
    { label: "Mejor", value: fmtMoney(stats.best === -Infinity ? 0 : stats.best), Icon: ArrowUpRight, cls: "text-emerald-400" },
    { label: "Peor", value: fmtMoney(stats.worst === Infinity ? 0 : stats.worst), Icon: ArrowDownRight, cls: "text-red-400" },
    { label: "Promedio Ganancia", value: fmtMoney(stats.avgWin), Icon: TrendingUp, cls: "text-emerald-400" },
    { label: "Promedio Pérdida", value: fmtMoney(-stats.avgLoss), Icon: TrendingDown, cls: "text-red-400" },
  ];

  // Row list: map closed positions back through augmented for derived prices.
  const augById = new Map(augmented.map((p) => [`${p.mt_login}-${p.position_id}`, p]));

  return (
    <Card className="card-glass p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Diario · Métricas Reales
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calculado desde operaciones cerradas sincronizadas (no manuales).
            {lastSync && <> · Última sync: {fmtTime(lastSync)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncing && syncProgress && (
            <>
              <span className="text-xs text-muted-foreground tabular-nums">
                Sincronizando… chunk {syncProgress.chunk} · {syncProgress.deals} deals
              </span>
              <Button size="sm" variant="ghost" onClick={cancelSync} className="rounded-full text-xs">
                Cancelar
              </Button>
            </>
          )}
          <Button size="sm" onClick={sync} disabled={syncing} className="rounded-full gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
        </div>
      </div>

      {reconstructed.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {reconstructed.length} {reconstructed.length === 1 ? "posición con precio reconstruido" : "posiciones con precios reconstruidos"} desde P&amp;L — el bróker no entregó el precio de cierre real.
        </div>
      )}

      {unrecoverable.length > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {unrecoverable.length} {unrecoverable.length === 1 ? "posición" : "posiciones"} sin precio recuperable (moneda no coincide o dato insuficiente) — excluidas de métricas.
        </div>
      )}

      {suppressKpis ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Métricas no disponibles — inconsistencia de datos detectada (incoherencia de signo en promedios). Sincroniza de nuevo o contacta soporte.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => {
            const Icon = k.Icon;
            return (
              <div key={k.label} className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</span>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className={`font-display text-xl font-semibold tabular-nums ${k.cls}`}>
                  {loading ? <span className="inline-block h-6 w-16 rounded skeleton-shimmer" /> : k.value}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
          <span>Símbolo · Cerrada</span>
          <span className="text-right">Lado</span>
          <span className="text-right">Vol</span>
          <span className="text-right">Apertura → Cierre</span>
          <span className="text-right">Origen</span>
          <span className="text-right">P&L Neto</span>
        </div>
        {loading ? (
          <div className="p-6 space-y-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-8 rounded skeleton-shimmer" />)}
          </div>
        ) : positions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Sin operaciones sincronizadas. Pulsa <span className="text-primary font-semibold">Sincronizar</span> para importar desde tu cuenta MT5.
          </div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
            {positions.slice(0, 50).map((p) => {
              const win = (p.net_pnl ?? 0) > 0;
              const isClosed = p.is_closed;
              const orders = p.position_id != null ? positionOrders.get(String(p.position_id)) : undefined;
              let origen: "Terminal" | "Externa" = "Externa";
              if (orders) {
                for (const ord of orders) { if (auditTickets.has(ord)) { origen = "Terminal"; break; } }
              }
              const aug = augById.get(`${p.mt_login}-${p.position_id}`);
              const recon = aug?._recon;
              const derivedOk = recon?.kind === "ok";
              const showDash = aug?._needsRecon && !derivedOk;
              const closeDisplay = derivedOk
                ? recon.close.toFixed(recon.digits)
                : showDash
                  ? "—"
                  : p.vwap_close?.toFixed(5) ?? "—";

              return (
                <div key={`${p.mt_login}-${p.position_id}`} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-3 py-2.5 text-sm items-center hover:bg-secondary/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">{p.symbol ?? "—"}</span>
                      {!isClosed && <Badge variant="secondary" className="text-[9px] rounded-full">Abierta</Badge>}
                      {p.has_complex_entry && <Badge variant="outline" className="text-[9px] rounded-full">Compleja</Badge>}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      #{p.position_id} · {fmtTime(p.close_time ?? p.open_time)}
                    </div>
                  </div>
                  <span className={`text-xs font-mono uppercase ${p.side === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                    {p.side === "buy" ? "Compra" : p.side === "sell" ? "Venta" : "—"}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">{(p.volume_in ?? 0).toFixed(2)}</span>
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {p.vwap_open?.toFixed(5) ?? "—"} →{" "}
                    {derivedOk ? (
                      <span
                        className="text-amber-300 underline decoration-dotted decoration-amber-400/60 cursor-help"
                        title={`Precio derivado del P&L · ${recon!.pips.toFixed(1)} pips · bróker no entregó el precio real`}
                      >
                        {closeDisplay}*
                      </span>
                    ) : (
                      <span>{closeDisplay}</span>
                    )}
                  </span>
                  <Badge variant="outline" className={`text-[10px] rounded-full ${origen === "Terminal" ? "border-primary/40 text-primary" : "border-border/40 text-muted-foreground"}`}>
                    {origen}
                  </Badge>
                  <span className={`font-display font-semibold tabular-nums ${isClosed ? (win ? "text-emerald-400" : "text-red-400") : "text-muted-foreground"}`}>
                    {isClosed ? fmtMoney(p.net_pnl ?? 0) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

export default JournalDashboardPanel;
