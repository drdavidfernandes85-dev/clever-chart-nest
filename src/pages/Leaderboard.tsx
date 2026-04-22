import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Crown, Medal, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import infinoxLogo from "@/assets/infinox-logo-white.png";

type Period = "pnl_7d" | "pnl_30d" | "total_pnl";

interface LeaderRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_trades: number;
  total_pnl: number;
  pnl_7d: number;
  pnl_30d: number;
  win_rate: number;
  best_trade: number;
  avg_r: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  pnl_7d: "Last 7 Days",
  pnl_30d: "Last 30 Days",
  total_pnl: "All Time",
};

const formatPnl = (n: number) => {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Crown className="h-5 w-5 text-primary" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
  if (rank === 3) return <Award className="h-5 w-5 text-primary/60" />;
  return <span className="font-mono text-sm text-muted-foreground w-5 text-center">{rank}</span>;
};

const Leaderboard = () => {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("pnl_30d");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("leaderboard_stats" as any)
        .select("*")
        .order(period, { ascending: false })
        .limit(50);
      if (!error && data) setRows(data as unknown as LeaderRow[]);
      setLoading(false);
    };
    load();
  }, [period]);

  const ranked = rows.filter((r) => r.total_trades > 0);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
            <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
              Elite <span className="text-primary">Live Trading Room</span>
            </span>
          </Link>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground gap-1.5">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
        </div>
      </header>

      <div className="container max-w-5xl py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Community</span>
            </div>
            <h1 className="font-heading text-4xl font-bold text-foreground uppercase tracking-tight">
              Trader <span className="text-gradient">Leaderboard</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ranked by realized P&L from the trade journal. Opt out anytime in your profile.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-card p-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  period === p
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-border/30 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Trader</div>
            <div className="col-span-2 text-right">P&L</div>
            <div className="col-span-2 text-right hidden sm:block">Win Rate</div>
            <div className="col-span-2 text-right">Trades</div>
          </div>

          {loading ? (
            <div className="divide-y divide-border/30">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-4 items-center">
                  <Skeleton className="col-span-1 h-5 w-5 rounded-full" />
                  <div className="col-span-5 flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="col-span-2 h-4 ml-auto w-20" />
                  <Skeleton className="col-span-2 h-4 ml-auto w-12 hidden sm:block" />
                  <Skeleton className="col-span-2 h-4 ml-auto w-10" />
                </div>
              ))}
            </div>
          ) : ranked.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">No ranked traders yet for this period.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Log a closed trade in the journal to appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {ranked.map((r, idx) => {
                const value = r[period] as number;
                const positive = value >= 0;
                const initial = (r.display_name || "?").charAt(0).toUpperCase();
                return (
                  <div
                    key={r.user_id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3.5 items-center transition-colors hover:bg-muted/30 ${
                      idx < 3 ? "bg-primary/[0.03]" : ""
                    }`}
                  >
                    <div className="col-span-1 flex items-center">
                      <RankBadge rank={idx + 1} />
                    </div>
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      {r.avatar_url ? (
                        <img
                          src={r.avatar_url}
                          alt={r.display_name}
                          className="h-9 w-9 rounded-full object-cover border border-border/50"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold border border-border/50">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.display_name}</p>
                        {r.avg_r > 0 && (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            avg {r.avg_r.toFixed(2)}R
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={`col-span-2 text-right font-mono text-sm font-semibold flex items-center justify-end gap-1 ${
                      positive ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {formatPnl(value)}
                    </div>
                    <div className="col-span-2 text-right text-sm text-foreground hidden sm:block font-mono">
                      {r.win_rate}%
                    </div>
                    <div className="col-span-2 text-right text-sm text-muted-foreground font-mono">
                      {r.total_trades}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Rankings update in real time as members close trades. Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  );
};

export default Leaderboard;
