import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogRow {
  id: string;
  created_at: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  classification: string | null;
  retcode_description: string | null;
  comment: string | null;
  error_message: string | null;
  ticket: string | null;
  response_payload: any | null;
}

const FILLED = new Set(["filled", "done", "partial"]);
const FAILED = new Set(["rejected", "failed", "error"]);

const statusTone = (s: string) => {
  const k = (s || "").toLowerCase();
  if (FILLED.has(k)) return "bg-emerald-500/15 text-emerald-400";
  if (FAILED.has(k)) return "bg-red-500/15 text-red-400";
  return "bg-[#FFCD05]/15 text-[#FFCD05]";
};

const sideTone = (s: string) =>
  (s || "").toLowerCase() === "buy"
    ? "bg-emerald-500/15 text-emerald-400"
    : "bg-red-500/15 text-red-400";

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
};

const getMessage = (l: LogRow): string => {
  const raw: any = l.response_payload ?? {};
  return (
    l.retcode_description ||
    raw?.retcodeDescription ||
    raw?.error?.message ||
    raw?.message ||
    l.error_message ||
    (l.ticket ? `Ticket #${l.ticket}` : null) ||
    l.comment ||
    "—"
  );
};

const TerminalExecutionLog = () => {
  const [rows, setRows] = useState<LogRow[]>([]);
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
        "id, created_at, symbol, side, volume, status, classification, retcode_description, comment, error_message, ticket, response_payload",
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data ?? []) as LogRow[]);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-mono uppercase tracking-widest text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading execution log…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="py-8 text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
        No trade executions yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[11px] font-mono">
        <thead className="bg-[#0a0a0a]">
          <tr className="text-left text-[9px] uppercase tracking-widest text-neutral-500">
            <th className="px-3 py-2 font-normal">Time</th>
            <th className="px-2 py-2 font-normal">Symbol</th>
            <th className="px-2 py-2 font-normal">Side</th>
            <th className="px-2 py-2 font-normal text-right">Volume</th>
            <th className="px-2 py-2 font-normal">Status</th>
            <th className="px-3 py-2 font-normal">Result / Message</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/70">
          {rows.map((l) => {
            const displayStatus =
              (l.status && l.status.toLowerCase() !== "unknown" && l.status) ||
              l.classification ||
              "failed";
            const msg = getMessage(l);
            const truncated = msg.length > 90 ? msg.slice(0, 87) + "…" : msg;
            return (
              <tr
                key={l.id}
                className="tabular-nums hover:bg-neutral-900/60 transition-colors"
              >
                <td className="px-3 py-1.5 text-neutral-400 whitespace-nowrap">
                  {fmtTime(l.created_at)}
                </td>
                <td className="px-2 py-1.5 font-bold text-neutral-100">
                  {l.symbol}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${sideTone(l.side)}`}
                  >
                    {l.side}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-200">
                  {Number(l.volume).toFixed(2)}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusTone(displayStatus)}`}
                  >
                    {displayStatus}
                  </span>
                </td>
                <td
                  className="px-3 py-1.5 max-w-[420px] truncate text-neutral-400"
                  title={msg}
                >
                  {truncated}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TerminalExecutionLog;
