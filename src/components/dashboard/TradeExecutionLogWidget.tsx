import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
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
  retcode_description: string | null;
  comment: string | null;
  error_message: string | null;
  ticket: string | null;
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

const statusTone = (s: string) => {
  if (["filled", "placed", "partial"].includes(s))
    return "bg-[hsl(145_65%_50%)]/15 text-[hsl(145_65%_55%)] border-[hsl(145_65%_50%)]/30";
  if (["rejected", "failed", "error"].includes(s))
    return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-muted/30 text-muted-foreground border-border/40";
};

const TradeExecutionLogWidget = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("trade_execution_logs")
      .select(
        "id, created_at, signal_id, symbol, side, volume, stop_loss, take_profit, status, classification, retcode_description, comment, error_message, ticket",
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
                <th className="py-2.5 px-3">Created</th>
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
                const brokerMsg =
                  l.retcode_description ||
                  l.comment ||
                  l.error_message ||
                  (l.ticket ? `Ticket #${l.ticket}` : "—");
                return (
                  <tr key={l.id} className="font-mono text-xs hover:bg-primary/5 transition-colors">
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {fmtTime(l.created_at)}
                    </td>
                    <td className="px-3 text-muted-foreground truncate max-w-[120px]">
                      {l.signal_id || "—"}
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
                          statusTone(l.status),
                        )}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-3 text-muted-foreground uppercase text-[10px]">
                      {l.classification || "—"}
                    </td>
                    <td className="px-3 text-muted-foreground truncate max-w-[260px]">
                      {brokerMsg}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default TradeExecutionLogWidget;
