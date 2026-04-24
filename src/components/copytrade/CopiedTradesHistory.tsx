import { useEffect, useState } from "react";
import { History, CheckCircle2, XCircle, Clock, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CopiedTrade {
  id: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  ea_ticket: string | null;
  ea_message: string | null;
  signal_id: string | null;
  created_at: string;
  executed_at: string | null;
}

const statusBadge = (status: string) => {
  switch (status) {
    case "executed":
      return {
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: "Executed",
        cls: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
      };
    case "failed":
      return {
        icon: <XCircle className="h-3 w-3" />,
        label: "Failed",
        cls: "bg-red-500/15 text-red-400 ring-red-500/30",
      };
    case "sent":
      return {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        label: "Sending",
        cls: "bg-primary/15 text-primary ring-primary/30",
      };
    default:
      return {
        icon: <Clock className="h-3 w-3" />,
        label: "Queued",
        cls: "bg-muted/30 text-muted-foreground ring-border/40",
      };
  }
};

interface Props {
  /** Show only signal-copied trades (signal_id IS NOT NULL). Defaults to true. */
  signalsOnly?: boolean;
  limit?: number;
  compact?: boolean;
}

const CopiedTradesHistory = ({ signalsOnly = true, limit = 8, compact = false }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<CopiedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchRows = async () => {
      let q = supabase
        .from("mt_pending_orders")
        .select(
          "id, symbol, side, volume, status, ea_ticket, ea_message, signal_id, created_at, executed_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (signalsOnly) q = q.not("signal_id", "is", null);
      const { data } = await q;
      if (!cancelled) {
        setRows((data ?? []) as CopiedTrade[]);
        setLoading(false);
      }
    };
    fetchRows();

    const channel = supabase
      .channel(`copied-trades-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mt_pending_orders",
          filter: `user_id=eq.${user.id}`,
        },
        fetchRows,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, signalsOnly, limit]);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Copied Trades
          </h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {rows.length} {rows.length === 1 ? "trade" : "trades"}
        </span>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            {signalsOnly
              ? "No signals copied yet. Tap 'Take This Signal' to start."
              : "No trades placed yet."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/30 max-h-96 overflow-y-auto">
          {rows.map((r) => {
            const isBuy = r.side === "buy";
            const badge = statusBadge(r.status);
            return (
              <li key={r.id} className={`px-4 ${compact ? "py-2.5" : "py-3"} hover:bg-muted/20 transition-colors`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isBuy ? (
                      <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-heading text-sm font-bold text-foreground tabular-nums">
                          {r.symbol}
                        </p>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {r.volume.toFixed(2)} lots
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {new Date(r.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {r.ea_ticket && r.ea_ticket !== "0" && (
                          <span className="ml-2 text-primary">#{r.ea_ticket}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ring-1 font-mono text-[9px] uppercase tracking-wider font-bold shrink-0 ${badge.cls}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                </div>
                {r.status === "failed" && r.ea_message && (
                  <p className="font-mono text-[10px] text-red-400/80 mt-1.5 pl-6 leading-snug">
                    {r.ea_message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CopiedTradesHistory;
