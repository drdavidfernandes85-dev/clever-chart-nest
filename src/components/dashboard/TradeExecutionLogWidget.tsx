import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Zap, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LogRow {
  id: string;
  created_at: string;
  signal_id: string | null;
  symbol: string;
  side: string;
  volume: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  classification: string | null;
  retcode: number | null;
  retcode_description: string | null;
  comment: string | null;
  error_message: string | null;
  ticket: string | null;
  http_status: number | null;
  response_payload: any | null;
}

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

const fmtNum = (v: number | null, digits = 5) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";

const FAILED_STATUSES = new Set(["rejected", "failed", "error"]);
const FILLED_STATUSES = new Set(["filled", "done", "partial"]);
const PLACED_STATUSES = new Set(["placed", "pending", "queued"]);

const statusTone = (s: string) => {
  const k = s.toLowerCase();
  if (FILLED_STATUSES.has(k))
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
  if (PLACED_STATUSES.has(k))
    return "bg-primary/15 text-primary border-primary/40";
  if (FAILED_STATUSES.has(k))
    return "bg-red-500/15 text-red-400 border-red-500/40";
  return "bg-muted/30 text-muted-foreground border-border/40";
};

const sideTone = (s: string) =>
  s?.toLowerCase() === "buy"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
    : "bg-red-500/15 text-red-400 border-red-500/40";

const stringifyMaybe = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s && s !== "{}" && s !== "[]" ? s : null;
  } catch {
    return null;
  }
};

const getBrokerMessage = (row: LogRow): string => {
  const raw: any = row.response_payload ?? {};
  return (
    stringifyMaybe(row.retcode_description) ||
    stringifyMaybe(raw?.retcodeDescription) ||
    stringifyMaybe(raw?.error?.message) ||
    stringifyMaybe(raw?.error) ||
    stringifyMaybe(raw?.message) ||
    stringifyMaybe(raw?.data?.retcode_description) ||
    stringifyMaybe(raw?.data?.comment) ||
    stringifyMaybe(row.error_message) ||
    stringifyMaybe(row.comment) ||
    "—"
  );
};

const TIME_FILTERS = [
  { key: "24h", label: "24h", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "All", ms: Infinity },
] as const;

type TimeFilterKey = typeof TIME_FILTERS[number]["key"];

const TradeExecutionLogWidget = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>("7d");
  const [pageSize, setPageSize] = useState<10 | 50>(10);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const { openTrade } = useQuickTrade();

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data } = await supabase
      .from("trade_execution_logs")
      .select(
        "id, created_at, signal_id, symbol, side, volume, stop_loss, take_profit, status, classification, retcode, retcode_description, comment, error_message, ticket, http_status, response_payload",
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((data ?? []) as LogRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(true), 15_000);
    const onTrade = () => load();
    window.addEventListener("trade-executed", onTrade);
    return () => {
      clearInterval(id);
      window.removeEventListener("trade-executed", onTrade);
    };
  }, []);

  const filtered = useMemo(() => {
    const cutoffMs = TIME_FILTERS.find((f) => f.key === timeFilter)?.ms ?? Infinity;
    const cutoff = Date.now() - cutoffMs;
    return logs
      .filter((l) => {
        if (cutoffMs === Infinity) return true;
        const t = new Date(l.created_at).getTime();
        return Number.isFinite(t) && t >= cutoff;
      })
      .slice(0, pageSize);
  }, [logs, timeFilter, pageSize]);

  const handleEmptyCta = () => {
    let lastSymbol: string | null = null;
    try {
      lastSymbol = window.localStorage.getItem("eltr.lastTradedSymbol");
    } catch { /* ignore */ }
    openTrade(lastSymbol ? { symbol: lastSymbol } : undefined);
  };

  return (
    <>
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card/80 to-background/40 backdrop-blur-xl p-5 shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.18)]">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
            Recent Trades
          </h2>
          <Badge variant="outline" className="border-primary/30 text-primary text-[10px] font-mono">
            {filtered.length}
          </Badge>
          {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}

          <div className="ml-auto flex items-center gap-3">
            {/* Time filter */}
            <div className="flex rounded-full border border-border/40 bg-background/40 p-0.5">
              {TIME_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTimeFilter(f.key)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-full transition-colors",
                    timeFilter === f.key
                      ? "bg-primary text-background font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Page size toggle */}
            <div className="flex rounded-full border border-border/40 bg-background/40 p-0.5">
              {[10, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setPageSize(n as 10 | 50)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-full transition-colors",
                    pageSize === n
                      ? "bg-primary text-background font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No trades yet. Execute your first trade from Quick Trade.
            </p>
            <Button
              onClick={handleEmptyCta}
              className="rounded-full bg-primary text-background hover:bg-primary/90 font-bold"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Open Quick Trade
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/30">
            <table className="w-full text-sm">
              <thead className="bg-background/50">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border/40">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="px-3">Symbol</th>
                  <th className="px-3">Direction</th>
                  <th className="px-3 text-right">Volume</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((l) => {
                  const displayStatus =
                    (l.status && l.status.toLowerCase() !== "unknown" && l.status) ||
                    l.classification ||
                    "failed";
                  const isFilled = FILLED_STATUSES.has(displayStatus.toLowerCase());
                  const result = isFilled
                    ? l.ticket
                      ? `Ticket #${l.ticket}`
                      : "Filled"
                    : getBrokerMessage(l);
                  const truncated =
                    result.length > 80 ? result.slice(0, 77) + "…" : result;
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="font-mono text-xs cursor-pointer hover:bg-primary/5 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {fmtTime(l.created_at)}
                      </td>
                      <td className="px-3 font-bold text-foreground">{l.symbol}</td>
                      <td className="px-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                            sideTone(l.side),
                          )}
                        >
                          {l.side}
                        </span>
                      </td>
                      <td className="px-3 text-right tabular-nums">
                        {Number(l.volume).toFixed(2)}
                      </td>
                      <td className="px-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                            statusTone(displayStatus),
                          )}
                        >
                          {displayStatus}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-3 max-w-[320px] truncate",
                          isFilled ? "text-emerald-400" : "text-muted-foreground",
                        )}
                        title={result}
                      >
                        {truncated}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trade details drawer */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card border-primary/20 text-foreground">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-tight flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Trade Details
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <DetailField label="Time" value={fmtTime(selected.created_at)} />
                <DetailField label="Symbol" value={selected.symbol} highlight />
                <DetailField
                  label="Direction"
                  value={selected.side?.toUpperCase()}
                  badgeClass={sideTone(selected.side)}
                />
                <DetailField
                  label="Status"
                  value={(selected.status || "—").toUpperCase()}
                  badgeClass={statusTone(selected.status)}
                />
                <DetailField label="Volume" value={Number(selected.volume).toFixed(2)} />
                <DetailField label="Ticket" value={selected.ticket || "—"} />
                <DetailField label="Stop Loss" value={fmtNum(selected.stop_loss)} />
                <DetailField label="Take Profit" value={fmtNum(selected.take_profit)} />
                <DetailField label="Retcode" value={selected.retcode != null ? String(selected.retcode) : "—"} />
                <DetailField label="HTTP Status" value={selected.http_status != null ? String(selected.http_status) : "—"} />
                <DetailField
                  label="Retcode Description"
                  value={selected.retcode_description || "—"}
                  wide
                />
                <DetailField label="Comment" value={selected.comment || "—"} wide />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                  Raw Broker Response
                </div>
                <pre className="max-h-72 overflow-auto rounded-md border border-border/40 bg-background/70 p-3 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                  {JSON.stringify(selected.response_payload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const DetailField = ({
  label,
  value,
  wide,
  highlight,
  badgeClass,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
  highlight?: boolean;
  badgeClass?: string;
}) => (
  <div className={cn("flex flex-col gap-0.5", wide && "col-span-2")}>
    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    {badgeClass ? (
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
          badgeClass,
        )}
      >
        {value || "—"}
      </span>
    ) : (
      <span
        className={cn(
          "break-words",
          highlight ? "text-primary font-bold" : "text-foreground",
        )}
      >
        {value && String(value).length > 0 ? value : "—"}
      </span>
    )}
  </div>
);

export default TradeExecutionLogWidget;
