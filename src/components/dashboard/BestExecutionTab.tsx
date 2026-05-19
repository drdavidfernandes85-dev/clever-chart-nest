import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, ShieldAlert, CheckCircle2, AlertOctagon, Activity, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  created_at: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  outcome: "success" | "blocked" | "rejected" | string;
  requested_price: number | null;
  executed_price: number | null;
  slippage: number | null;
  latency_ms: number | null;
  spread: number | null;
  broker_message: string | null;
};

const fmtNum = (n: number | null | undefined, d = 5) =>
  n == null || !Number.isFinite(Number(n)) ? "—" : Number(n).toFixed(d);
const fmtSlip = (n: number | null | undefined, d = 5) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(d)}`;
const fmtMs = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(Number(n))} ms`;

const StatusPill = ({ outcome, status }: { outcome: string; status: string }) => {
  const cls =
    outcome === "success"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
      : outcome === "blocked"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
        : "bg-red-500/15 text-red-300 border-red-500/40";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-widest",
        cls,
      )}
    >
      {(status || outcome).toString().slice(0, 14)}
    </span>
  );
};

const Card = ({
  label,
  value,
  Icon,
  tint,
}: {
  label: string;
  value: string;
  Icon: typeof Activity;
  tint?: string;
}) => (
  <div className="rounded border border-neutral-800/80 bg-[#0a0a0a] px-3 py-2 flex items-center gap-2 min-w-[140px]">
    <span className={cn("flex h-7 w-7 items-center justify-center rounded border border-neutral-800", tint)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
    <div className="leading-tight">
      <div className="text-[8.5px] font-mono uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </div>
      <div className="font-mono text-[13px] font-bold tabular-nums text-neutral-100">
        {value}
      </div>
    </div>
  </div>
);

export const BestExecutionTab = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [symbolFilter, setSymbolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("execution_audit_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    const { data, error } = await q;
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("mt:refresh-execution-logs", handler);
    return () => window.removeEventListener("mt:refresh-execution-logs", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, from, to]);

  const filtered = useMemo(() => {
    const sq = symbolFilter.trim().toUpperCase();
    return rows.filter((r) => {
      if (sq && !(r.symbol || "").toUpperCase().includes(sq)) return false;
      if (statusFilter !== "all" && r.outcome !== statusFilter) return false;
      return true;
    });
  }, [rows, symbolFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const successes = filtered.filter((r) => r.outcome === "success");
    const blocked = filtered.filter((r) => r.outcome === "blocked").length;
    const rejected = filtered.filter((r) => r.outcome === "rejected").length;
    const latencies = filtered.map((r) => r.latency_ms).filter((v): v is number => v != null);
    const slips = successes.map((r) => r.slippage).filter((v): v is number => v != null);
    const avgLat = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
    const avgSlip = slips.length ? slips.reduce((a, b) => a + b, 0) / slips.length : null;
    const rejectionRate = total ? (rejected / total) * 100 : null;
    return {
      total,
      avgLat,
      avgSlip,
      rejectionRate,
      blocked,
      successes: successes.length,
    };
  }, [filtered]);

  const symbols = useMemo(
    () => Array.from(new Set(rows.map((r) => r.symbol))).sort(),
    [rows],
  );

  return (
    <div className="p-3">
      {/* Summary cards */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Card
          label="Avg Latency"
          value={stats.avgLat != null ? fmtMs(stats.avgLat) : "—"}
          Icon={Gauge}
          tint="text-sky-300 bg-sky-500/10"
        />
        <Card
          label="Avg Slippage"
          value={stats.avgSlip != null ? fmtSlip(stats.avgSlip, 5) : "—"}
          Icon={Activity}
          tint={
            stats.avgSlip == null
              ? "text-neutral-400"
              : stats.avgSlip < 0
                ? "text-emerald-300 bg-emerald-500/10"
                : "text-amber-300 bg-amber-500/10"
          }
        />
        <Card
          label="Rejection Rate"
          value={stats.rejectionRate != null ? `${stats.rejectionRate.toFixed(1)}%` : "—"}
          Icon={AlertOctagon}
          tint="text-red-300 bg-red-500/10"
        />
        <Card
          label="Blocked"
          value={String(stats.blocked)}
          Icon={ShieldAlert}
          tint="text-amber-300 bg-amber-500/10"
        />
        <Card
          label="Successful"
          value={String(stats.successes)}
          Icon={CheckCircle2}
          tint="text-emerald-300 bg-emerald-500/10"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Input
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          placeholder="Symbol"
          className="h-7 w-[140px] bg-[#050505] border-neutral-800 text-[11px] font-mono"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-[140px] bg-[#050505] border-neutral-800 text-[11px] font-mono">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-7 w-[150px] bg-[#050505] border-neutral-800 text-[11px] font-mono"
        />
        <span className="text-[10px] font-mono text-neutral-500">→</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-7 w-[150px] bg-[#050505] border-neutral-800 text-[11px] font-mono"
        />
        <button
          type="button"
          onClick={load}
          className="flex h-7 items-center gap-1.5 rounded border border-neutral-800 bg-[#0a0a0a] px-2 text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-[#FFCD05] hover:border-[#FFCD05]/40"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
        {symbols.length > 0 && symbolFilter === "" && (
          <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-600 ml-auto">
            {filtered.length} of {rows.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded border border-neutral-800 bg-[#0a0a0a] overflow-hidden">
        <div className="grid grid-cols-[130px_90px_50px_60px_90px_90px_90px_80px_70px_70px_1fr] gap-2 border-b border-neutral-800 bg-[#050505] px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest text-neutral-500">
          <span>Created</span>
          <span>Symbol</span>
          <span>Side</span>
          <span className="text-right">Volume</span>
          <span>Status</span>
          <span className="text-right">Req Px</span>
          <span className="text-right">Exec Px</span>
          <span className="text-right">Slip</span>
          <span className="text-right">Latency</span>
          <span className="text-right">Spread</span>
          <span>Broker Message</span>
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-mono text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading audit log…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              No execution events match the current filters.
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[130px_90px_50px_60px_90px_90px_90px_80px_70px_70px_1fr] gap-2 border-b border-neutral-900/80 px-2 py-1.5 text-[10.5px] font-mono tabular-nums text-neutral-200 hover:bg-neutral-900/40"
              >
                <span className="text-neutral-400">
                  {new Date(r.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}
                </span>
                <span className="text-[#FFCD05]">{r.symbol}</span>
                <span className={cn(r.side === "buy" ? "text-emerald-300" : "text-red-300")}>
                  {(r.side || "").toUpperCase()}
                </span>
                <span className="text-right">{Number(r.volume).toFixed(2)}</span>
                <span><StatusPill outcome={r.outcome} status={r.status} /></span>
                <span className="text-right">{fmtNum(r.requested_price, 5)}</span>
                <span className="text-right">{fmtNum(r.executed_price, 5)}</span>
                <span
                  className={cn(
                    "text-right",
                    r.slippage == null
                      ? "text-neutral-500"
                      : Number(r.slippage) < 0
                        ? "text-emerald-300"
                        : Number(r.slippage) > 0
                          ? "text-amber-300"
                          : "text-neutral-300",
                  )}
                >
                  {fmtSlip(r.slippage, 5)}
                </span>
                <span className="text-right">{fmtMs(r.latency_ms)}</span>
                <span className="text-right">{fmtNum(r.spread, 5)}</span>
                <span className="truncate text-neutral-400" title={r.broker_message ?? ""}>
                  {r.broker_message || "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BestExecutionTab;
