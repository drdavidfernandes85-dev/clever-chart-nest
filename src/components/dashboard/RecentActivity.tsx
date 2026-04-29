import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, ArrowUpRight, Plug, Search, Download, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useMTAccount } from "@/hooks/useMTAccount";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { toCSV, downloadCSV } from "@/lib/csv";
import { toast } from "sonner";

interface Activity {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  pnl: number;
  closedAt: string;
  /** ISO string or null — used for CSV export */
  closedAtISO: string | null;
  status: "open" | "closed";
}

type SideFilter = "all" | "buy" | "sell";
type PnlFilter = "all" | "win" | "loss";

const RecentActivity = () => {
  const { user } = useAuth();
  const { account, positions } = useMTAccount();
  const isConnected = !!account && account.status === "connected";
  const [closedTrades, setClosedTrades] = useState<Activity[]>([]);
  const [query, setQuery] = useState("");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>("all");

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
        .limit(50);
      setClosedTrades(
        (data ?? []).map((t: any) => ({
          id: t.id,
          symbol: t.pair,
          side: t.direction === "long" || t.direction === "buy" ? "buy" : "sell",
          pnl: Number(t.pnl ?? 0),
          closedAt: t.closed_at
            ? formatDistanceToNow(new Date(t.closed_at), { addSuffix: false }) + " ago"
            : "—",
          closedAtISO: t.closed_at ?? null,
          status: "closed" as const,
        })),
      );
    })();
  }, [user]);

  // Combine open MT positions (as live entries) + closed trades
  const livePositionsAsActivity: Activity[] = isConnected
    ? positions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        pnl: Number(p.profit ?? 0),
        closedAt: "open",
        closedAtISO: null,
        status: "open" as const,
      }))
    : [];

  const all: Activity[] = [...livePositionsAsActivity, ...closedTrades];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((a) => {
      if (sideFilter !== "all" && a.side !== sideFilter) return false;
      if (pnlFilter === "win" && a.pnl < 0) return false;
      if (pnlFilter === "loss" && a.pnl >= 0) return false;
      if (q && !a.symbol.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, query, sideFilter, pnlFilter]);

  const items = filtered.slice(0, 8);
  const showEmptyHint = !isConnected && closedTrades.length === 0;
  const hasFilters =
    query.trim() !== "" || sideFilter !== "all" || pnlFilter !== "all";

  const handleExport = () => {
    const rows = filtered.map((a) => ({
      symbol: a.symbol,
      side: a.side.toUpperCase(),
      pnl: a.pnl.toFixed(2),
      status: a.status,
      closed_at: a.closedAtISO ?? "",
    }));
    if (!rows.length) {
      toast.error("Nothing to export", { description: "Adjust filters and try again." });
      return;
    }
    const csv = toCSV(rows, [
      { key: "symbol", label: "Symbol" },
      { key: "side", label: "Side" },
      { key: "pnl", label: "P/L (USD)" },
      { key: "status", label: "Status" },
      { key: "closed_at", label: "Closed At" },
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`recent-activity-${stamp}.csv`, csv);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  };

  const clearFilters = () => {
    setQuery("");
    setSideFilter("all");
    setPnlFilter("all");
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            title="Export filtered rows to CSV"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:text-primary/80"
          >
            View all
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-5 py-2.5">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol…"
            className="w-full rounded-md border border-border/40 bg-background/50 pl-7 pr-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <select
          value={sideFilter}
          onChange={(e) => setSideFilter(e.target.value as SideFilter)}
          className="rounded-md border border-border/40 bg-background/50 px-1.5 py-1 text-[11px] font-mono text-foreground focus:border-primary/40 focus:outline-none"
          aria-label="Filter by side"
        >
          <option value="all">All sides</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <select
          value={pnlFilter}
          onChange={(e) => setPnlFilter(e.target.value as PnlFilter)}
          className="rounded-md border border-border/40 bg-background/50 px-1.5 py-1 text-[11px] font-mono text-foreground focus:border-primary/40 focus:outline-none"
          aria-label="Filter by P/L"
        >
          <option value="all">All P/L</option>
          <option value="win">Wins only</option>
          <option value="loss">Losses only</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            title="Clear filters"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
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
        {items.length === 0 && !showEmptyHint && (
          <li className="px-5 py-6 text-center text-[11px] text-muted-foreground">
            No activity matches your filters.
          </li>
        )}
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
