import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, ArrowUpRight, Plug } from "lucide-react";
import { Link } from "react-router-dom";
import { useMTAccount } from "@/hooks/useMTAccount";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  pnl: number;
  closedAt: string;
}

const RecentActivity = () => {
  const { user } = useAuth();
  const { account, positions } = useMTAccount();
  const isConnected = !!account && account.status === "connected";
  const [closedTrades, setClosedTrades] = useState<Activity[]>([]);

  // Pull closed trades from trade_journal as a richer real-data source
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("trade_journal")
        .select("id, pair, direction, pnl, closed_at, opened_at")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .not("pnl", "is", null)
        .order("closed_at", { ascending: false })
        .limit(8);
      setClosedTrades(
        (data ?? []).map((t: any) => ({
          id: t.id,
          symbol: t.pair,
          side: t.direction === "long" || t.direction === "buy" ? "buy" : "sell",
          pnl: Number(t.pnl ?? 0),
          closedAt: t.closed_at
            ? formatDistanceToNow(new Date(t.closed_at), { addSuffix: false }) + " ago"
            : "—",
        })),
      );
    })();
  }, [user]);

  // Combine open MT positions (as live entries) + closed trades
  const livePositionsAsActivity: Activity[] = isConnected
    ? positions.slice(0, 5).map((p) => ({
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        pnl: Number(p.profit ?? 0),
        closedAt: "open",
      }))
    : [];

  const items: Activity[] = [...livePositionsAsActivity, ...closedTrades].slice(0, 8);
  const showEmptyHint = !isConnected && closedTrades.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <History className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground tracking-wide">
            Recent Activity
          </h3>
          {isConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              MT
            </span>
          )}
        </div>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:text-primary/80"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="divide-y divide-border/30">
        {items.map((a) => {
          const up = a.pnl >= 0;
          return (
            <li
              key={a.id}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors"
            >
              <span
                className={`inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                  a.side === "buy"
                    ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-red-500/10 text-red-400 ring-1 ring-red-500/30"
                }`}
              >
                {a.side}
              </span>
              <span className="font-heading text-xs font-semibold text-foreground min-w-0 flex-1 truncate">
                {a.symbol}
              </span>
              <span
                className={`font-mono text-xs font-semibold tabular-nums ${
                  up ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {up ? "+" : "−"}${Math.abs(a.pnl).toFixed(2)}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-14 text-right shrink-0">
                {a.closedAt}
              </span>
            </li>
          );
        })}
      </ul>

      {showEmptyHint && (
        <Link
          to="/connect-mt"
          className="block border-t border-border/40 px-5 py-2.5 text-center text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <Plug className="inline h-3 w-3 mr-1" />
          Connect MT4/5 for real activity
        </Link>
      )}
    </motion.div>
  );
};

export default RecentActivity;
