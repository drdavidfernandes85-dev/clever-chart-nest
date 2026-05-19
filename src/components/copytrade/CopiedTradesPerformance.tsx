import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Target,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PoweredByTradingLayer from "@/components/PoweredByTradingLayer";

interface PendingOrderRow {
  id: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  signal_id: string | null;
  ea_ticket: string | null;
  created_at: string;
}

interface SignalRow {
  id: string;
  author_id: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  direction: string;
}

interface PositionRow {
  ticket: string;
  open_price: number;
  current_price: number | null;
  profit: number | null;
  commission: number | null;
  swap: number | null;
}

interface EquityRow {
  equity: number | null;
}

interface RowVm {
  id: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  entry: number | null;
  netPnl: number | null;
  riskUsd: number | null;
  mentorName: string;
  signal?: SignalRow;
}

const statusPill = (s: string) => {
  if (s === "executed" || s === "filled" || s === "done")
    return { icon: <CheckCircle2 className="h-3 w-3" />, label: "Live", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (s === "failed" || s === "rejected")
    return { icon: <XCircle className="h-3 w-3" />, label: "Failed", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (s === "sent")
    return { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Sending", cls: "bg-[#FFCD05]/15 text-[#FFCD05] border-[#FFCD05]/30" };
  return { icon: <Clock className="h-3 w-3" />, label: "Queued", cls: "bg-white/5 text-white/60 border-white/15" };
};

const fmt = (n: number | null | undefined, d = 5) =>
  n == null || !isFinite(Number(n)) ? "—" : Number(n).toFixed(d);
const money = (n: number | null | undefined) =>
  n == null || !isFinite(Number(n)) ? "—" : `${Number(n) >= 0 ? "+" : ""}$${Number(n).toFixed(2)}`;

interface Props {
  /** When true (default), takes full card width. Set false for compact embed. */
  className?: string;
  limit?: number;
}

/**
 * "My Copied Trades" performance card.
 * Joins mt_pending_orders (signal_id IS NOT NULL) with trading_signals → mentor profile
 * and mt_positions for live P&L. Shows summary stats + table.
 */
const CopiedTradesPerformance = ({ className = "", limit = 50 }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<RowVm[]>([]);
  const [loading, setLoading] = useState(true);
  const [equity, setEquity] = useState<number | null>(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const { data: orders } = await supabase
      .from("mt_pending_orders")
      .select("id, symbol, side, volume, status, entry_price, stop_loss, take_profit, signal_id, ea_ticket, created_at")
      .eq("user_id", user.id)
      .not("signal_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    const oList: PendingOrderRow[] = (orders || []) as PendingOrderRow[];

    const signalIds = Array.from(new Set(oList.map((o) => o.signal_id).filter(Boolean))) as string[];
    const tickets = Array.from(new Set(oList.map((o) => o.ea_ticket).filter((t) => t && t !== "0"))) as string[];

    const [{ data: signals }, { data: positions }, { data: acct }] = await Promise.all([
      signalIds.length
        ? supabase.from("trading_signals")
            .select("id, author_id, entry_price, stop_loss, take_profit, status, direction")
            .in("id", signalIds)
        : Promise.resolve({ data: [] as any[] }),
      Promise.resolve({ data: [] as any[] }), // mt_positions removed — live data sourced from Trading Layer

      supabase.from("user_mt_accounts").select("equity").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

    const sigMap = new Map<string, SignalRow>();
    (signals || []).forEach((s: any) => sigMap.set(s.id, s));
    const posMap = new Map<string, PositionRow>();
    (positions || []).forEach((p: any) => posMap.set(p.ticket, p));

    const authorIds = Array.from(new Set((signals || []).map((s: any) => s.author_id)));
    let nameMap = new Map<string, string>();
    if (authorIds.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, display_name").in("user_id", authorIds);
      (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.display_name || "Mentor"));
    }

    setEquity((acct as EquityRow | null)?.equity ?? null);

    const vm: RowVm[] = oList.map((o) => {
      const sig = o.signal_id ? sigMap.get(o.signal_id) : undefined;
      const pos = o.ea_ticket && o.ea_ticket !== "0" ? posMap.get(o.ea_ticket) : undefined;
      const entry = pos?.open_price ?? o.entry_price ?? sig?.entry_price ?? null;

      let netPnl: number | null = null;
      if (pos && pos.profit != null) {
        netPnl = Number(pos.profit) + Number(pos.commission || 0) + Number(pos.swap || 0);
      }

      // Risk estimate (USD) from SL distance × volume (rough — pips-agnostic; uses price units).
      let riskUsd: number | null = null;
      const sl = o.stop_loss ?? sig?.stop_loss ?? null;
      if (entry != null && sl != null) {
        const dist = Math.abs(Number(entry) - Number(sl));
        // Use position pnl-per-price-unit when available, else fall back to 1:1 (approximation)
        if (pos && pos.current_price != null && pos.open_price && pos.profit != null) {
          const move = Math.abs(Number(pos.current_price) - Number(pos.open_price));
          if (move > 0) {
            const pnlPerUnit = Math.abs(Number(pos.profit)) / move;
            riskUsd = dist * pnlPerUnit;
          }
        }
        if (riskUsd == null) {
          // Fallback heuristic: $10 per 1.0 lot per 1 price unit
          riskUsd = dist * Number(o.volume) * 10;
        }
      }

      return {
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        volume: Number(o.volume),
        status: o.status,
        entry,
        netPnl,
        riskUsd,
        mentorName: sig ? (nameMap.get(sig.author_id) || "Mentor") : "—",
        signal: sig,
      };
    });

    setRows(vm);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`copy-perf-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mt_pending_orders", filter: `user_id=eq.${user.id}` }, load)
      // mt_positions realtime subscription removed.
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const summary = useMemo(() => {
    const closedWithPnl = rows.filter((r) => r.netPnl != null);
    const wins = closedWithPnl.filter((r) => (r.netPnl ?? 0) > 0).length;
    const winRate = closedWithPnl.length ? (wins / closedWithPnl.length) * 100 : null;
    const totalPnl = closedWithPnl.reduce((a, r) => a + Number(r.netPnl || 0), 0);
    const risks = rows.filter((r) => r.riskUsd != null && equity && equity > 0);
    const avgRiskPct = risks.length
      ? risks.reduce((a, r) => a + (Number(r.riskUsd!) / equity!) * 100, 0) / risks.length
      : null;
    return { totalPnl, winRate, avgRiskPct, count: rows.length };
  }, [rows, equity]);

  return (
    <div className={`rounded-2xl border border-white/10 bg-[#0F0F0F] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Copy className="h-3.5 w-3.5 text-[#FFCD05]" />
          <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            My Reviewed Ideas
          </h3>
          <PoweredByTradingLayer variant="muted" className="ml-1" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
          {summary.count} {summary.count === 1 ? "idea" : "ideas"}
        </span>
      </div>
      <p className="px-4 pt-3 text-[10.5px] leading-snug text-white/50">
        Market Ideas are provided for educational and informational purposes only. They are not investment advice, financial advice, or personal recommendations. Users are solely responsible for deciding whether to review, modify, or execute any idea.
      </p>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-px bg-white/5">
        <SummaryTile
          label="Total Idea P&L"
          value={summary.count ? money(summary.totalPnl) : "—"}
          accent={summary.totalPnl >= 0 ? "green" : "red"}
        />
        <SummaryTile
          label="Win Rate"
          value={summary.winRate != null ? `${summary.winRate.toFixed(1)}%` : "—"}
          accent="yellow"
        />
        <SummaryTile
          label="Avg Risk %"
          value={summary.avgRiskPct != null ? `${summary.avgRiskPct.toFixed(2)}%` : "—"}
        />
      </div>

      {loading ? (
        <div className="px-4 py-10 text-center text-xs text-white/40 flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Inbox className="h-7 w-7 text-white/30 mx-auto mb-2" />
          <p className="text-[12px] text-white/50">
            No reviewed ideas yet. Review educational market ideas from the Community Hub or Ideas page to get started.
          </p>
        </div>
      ) : (
        <div className="max-h-[460px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#0a0a0a] z-10">
              <tr className="border-b border-white/10">
                {["Educator", "Symbol", "Dir", "Vol", "Entry", "P&L", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/40 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isBuy = r.side === "buy";
                const badge = statusPill(r.status);
                return (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-white truncate max-w-[120px] inline-block">
                        {r.mentorName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-white tabular-nums">
                      {r.symbol}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                        {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {r.side}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-white/80 tabular-nums">
                      {r.volume.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-white/80 tabular-nums">
                      {fmt(r.entry)}
                    </td>
                    <td className={`px-3 py-2.5 font-mono text-[11px] font-bold tabular-nums ${
                      r.netPnl == null ? "text-white/40"
                      : r.netPnl >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {r.netPnl == null ? "—" : money(r.netPnl)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-bold ${badge.cls}`}>
                        {badge.icon}{badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-white/10 px-3 py-2 flex items-center gap-1.5 text-[10px] font-mono text-white/40">
        <Target className="h-3 w-3 text-[#FFCD05]" />
        Risk % estimated from SL distance × volume vs current equity.
      </div>
    </div>
  );
};

const SummaryTile = ({ label, value, accent }: { label: string; value: string; accent?: "yellow" | "green" | "red" }) => {
  const cls = accent === "yellow" ? "text-[#FFCD05]"
    : accent === "green" ? "text-emerald-400"
    : accent === "red" ? "text-red-400"
    : "text-white";
  return (
    <div className="bg-[#0F0F0F] px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-0.5 font-heading text-base font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
};

export default CopiedTradesPerformance;
