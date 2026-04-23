import { motion } from "framer-motion";
import { History, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Activity {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  pnl: number;
  closedAt: string;
}

const RECENT: Activity[] = [
  { id: "1", symbol: "EUR/USD", side: "buy", pnl: 312.4, closedAt: "2m ago" },
  { id: "2", symbol: "XAU/USD", side: "buy", pnl: 845.0, closedAt: "18m ago" },
  { id: "3", symbol: "USD/JPY", side: "sell", pnl: -127.5, closedAt: "47m ago" },
  { id: "4", symbol: "GBP/JPY", side: "sell", pnl: 218.9, closedAt: "1h ago" },
  { id: "5", symbol: "AUD/USD", side: "buy", pnl: -64.2, closedAt: "2h ago" },
];

const RecentActivity = () => {
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
        {RECENT.map((a) => {
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
    </motion.div>
  );
};

export default RecentActivity;
