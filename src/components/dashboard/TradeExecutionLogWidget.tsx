import { useEffect, useState, Fragment } from "react";
import { ChevronDown, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const statusTone = (s: string) => {
  if (["filled", "placed", "partial"].includes(s))
    return "bg-[hsl(145_65%_50%)]/15 text-[hsl(145_65%_55%)] border-[hsl(145_65%_50%)]/30";
  if (FAILED_STATUSES.has(s))
    return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-muted/30 text-muted-foreground border-border/40";
};

/** Pick the most informative error message available. */
const resolveErrorMessage = (l: LogRow): string => {
  const r = l.response_payload ?? {};
  const raw = r.raw ?? {};
  const candidates = [
    r.error,
    l.retcode_description,
    r.retcodeDescription,
    raw?.error?.message,
    raw?.message,
    typeof raw?.error === "string" ? raw.error : null,
    l.error_message,
    l.comment,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  if (l.http_status && l.http_status >= 400) {
    return `Trade execution failed (HTTP ${l.http_status})`;
  }
  return "Trade execution failed";
};

const TradeExecutionLogWidget = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setLoading(false);
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
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    const onTrade = () => load();
    window.addEventListener("trade-executed", onTrade);
    return () => {
      clearInterval(id);
      window.removeEventListener("trade-executed", onTrade);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card/80 to-background/40 backdrop-blur-xl p-5 shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.18)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ClipboardList className="h-4 w-4" />
        </div>
        <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
          Trade Execution Log
        </h2>
        <Badge variant="outline" className="ml-auto border-primary/30 text-primary text-[10px] font-mono">
          {logs.length}
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
          No trades executed yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/30">
          <table className="w-full text-sm">
            <thead className="bg-background/50">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border/40">
                <th className="py-2.5 px-3 w-6"></th>
                <th className="px-3">Created</th>
                <th className="px-3">Trade ID</th>
                <th className="px-3">Symbol</th>
                <th className="px-3">Direction</th>
                <th className="px-3 text-right">Volume</th>
                <th className="px-3 text-right">SL</th>
                <th className="px-3 text-right">TP</th>
                <th className="px-3">Status</th>
                <th className="px-3">Classification</th>
                <th className="px-3">Broker Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {logs.map((l) => {
                // Backend stores the Trading Layer raw response in
                // `response_payload`; expose it as `raw_response` to match the
                // documented mapping. `signal_id` doubles as the trade_id.
                const raw_response = l.response_payload ?? null;
                const trade_id = l.signal_id || l.id;

                // Status: prefer recorded status, fall back to classification,
                // then "failed" — never "unknown".
                const displayStatus =
                  (l.status && l.status.toLowerCase() !== "unknown" && l.status) ||
                  l.classification ||
                  "failed";
                const displayClassification = l.classification || "—";
                const displayBrokerMsg =
                  l.retcode_description ||
                  (raw_response as any)?.error ||
                  (raw_response as any)?.message ||
                  resolveErrorMessage(l) ||
                  "—";

                const isFailed = FAILED_STATUSES.has(displayStatus.toLowerCase());
                const isOpen = expanded.has(l.id);
                const tradingLayerStatus =
                  (raw_response as any)?.tradingLayerStatus ??
                  (raw_response as any)?.raw?.status ??
                  null;
                const retcodeName =
                  (raw_response as any)?.retcodeName ??
                  (raw_response as any)?.raw?.retcodeName ??
                  null;
                return (
                  <Fragment key={l.id}>
                    <tr className="font-mono text-xs hover:bg-primary/5 transition-colors">
                      <td className="py-2.5 px-2 align-top">
                        {isFailed ? (
                          <button
                            type="button"
                            onClick={() => toggle(l.id)}
                            aria-label={isOpen ? "Hide details" : "Show details"}
                            className="text-muted-foreground hover:text-primary"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {fmtTime(l.created_at)}
                      </td>
                      <td
                        className="px-3 text-muted-foreground truncate max-w-[140px]"
                        title={trade_id}
                      >
                        {trade_id}
                      </td>
                      <td className="px-3 font-bold text-foreground">{l.symbol}</td>
                      <td className="px-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            l.side?.toLowerCase() === "buy"
                              ? "bg-[hsl(145_65%_50%)]/15 text-[hsl(145_65%_55%)]"
                              : "bg-red-500/15 text-red-400",
                          )}
                        >
                          {l.side}
                        </span>
                      </td>
                      <td className="px-3 text-right tabular-nums">{Number(l.volume).toFixed(2)}</td>
                      <td className="px-3 text-right tabular-nums text-muted-foreground">
                        {fmtNum(l.stop_loss)}
                      </td>
                      <td className="px-3 text-right tabular-nums text-muted-foreground">
                        {fmtNum(l.take_profit)}
                      </td>
                      <td className="px-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                            statusTone(displayStatus.toLowerCase()),
                          )}
                        >
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-3 text-muted-foreground uppercase text-[10px]">
                        {displayClassification}
                      </td>
                      <td
                        className={cn(
                          "px-3 max-w-[320px] truncate",
                          isFailed ? "text-red-400" : "text-muted-foreground",
                        )}
                        title={String(displayBrokerMsg)}
                      >
                        {String(displayBrokerMsg)}
                      </td>
                    </tr>
                    {isFailed && isOpen && (
                      <tr className="bg-background/40">
                        <td colSpan={11} className="px-4 py-3">
                          <div className="grid gap-2 md:grid-cols-2 text-[11px] font-mono">
                            <DetailField label="Trading Layer status" value={tradingLayerStatus} />
                            <DetailField label="Classification" value={l.classification} />
                            <DetailField
                              label="HTTP status"
                              value={l.http_status != null ? String(l.http_status) : null}
                            />
                            <DetailField
                              label="Retcode"
                              value={l.retcode != null ? String(l.retcode) : null}
                            />
                            <DetailField label="Retcode name" value={retcodeName} />
                            <DetailField
                              label="Retcode description"
                              value={l.retcode_description}
                            />
                            <DetailField
                              label="Resolved error"
                              value={resolveErrorMessage(l)}
                              wide
                            />
                          </div>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary">
                              Raw response
                            </summary>
                            <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border/40 bg-background/70 p-3 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                              {JSON.stringify(l.response_payload ?? {}, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const DetailField = ({
  label,
  value,
  wide,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}) => (
  <div className={cn("flex flex-col gap-0.5", wide && "md:col-span-2")}>
    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    <span className="text-foreground break-words">
      {value && String(value).length > 0 ? value : "—"}
    </span>
  </div>
);

export default TradeExecutionLogWidget;
