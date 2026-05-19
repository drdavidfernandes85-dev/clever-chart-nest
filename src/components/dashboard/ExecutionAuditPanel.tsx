import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type AuditRow = {
  id: string;
  created_at: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  requested_price: number | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  broker_message: string | null;
  raw: any;
};

import { prettyAuditStatus, prettyAuditClassification } from "@/lib/auditLabels";

const prettyStatus = prettyAuditStatus;
const prettyClass = prettyAuditClassification;


export default function ExecutionAuditPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("execution_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) setError(error.message);
    else setRows((data ?? []) as AuditRow[]);
    setFetchedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <section className="rounded-xl border border-[#FFCD05]/30 bg-background/60 backdrop-blur p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#FFCD05]" />
          <h2 className="text-sm font-semibold tracking-wide">Latest Execution Audit Events</h2>
          <Badge variant="outline" className="border-[#FFCD05]/40 text-[#FFCD05] text-[10px]">DEV</Badge>
          {fetchedAt && (
            <span className="text-[10px] text-muted-foreground">{new Date(fetchedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}
          className="border-[#FFCD05]/40 text-[#FFCD05] hover:bg-[#FFCD05]/10">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-auto max-h-[420px] rounded-lg border border-border/40">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-black/60 text-[#FFCD05]/80 sticky top-0">
            <tr>
              {["created_at","symbol","side","volume","status","classification","requested_price","quote_bid","quote_ask","quote_spread","broker_message"].map(h => (
                <th key={h} className="px-2 py-1.5 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr><td colSpan={11} className="px-2 py-3 text-center text-muted-foreground">No audit events yet</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border/30 hover:bg-[#FFCD05]/5">
                <td className="px-2 py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleTimeString()}</td>
                <td className="px-2 py-1">{r.symbol}</td>
                <td className="px-2 py-1">{r.side}</td>
                <td className="px-2 py-1">{r.volume}</td>
                <td className="px-2 py-1">{prettyStatus(r.status)}</td>
                <td className="px-2 py-1">{prettyClass(r.raw?.classification)}</td>
                <td className="px-2 py-1">{r.requested_price ?? "—"}</td>
                <td className="px-2 py-1">{r.bid ?? "—"}</td>
                <td className="px-2 py-1">{r.ask ?? "—"}</td>
                <td className="px-2 py-1">{r.spread ?? "—"}</td>
                <td className="px-2 py-1 max-w-[260px] truncate" title={r.broker_message ?? ""}>{r.broker_message ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
