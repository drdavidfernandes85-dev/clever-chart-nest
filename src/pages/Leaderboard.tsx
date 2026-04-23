import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Crown,
  Medal,
  Award,
  Flame,
  Users,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import { toast } from "sonner";

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

interface DemoRow extends LeaderRow {
  profit_factor: number;
  win_streak: number;
  followers: number;
  verified?: boolean;
  badge?: string;
}

const PERIOD_LABELS: Record<Period, string> = {
  pnl_7d: "Last 7 Days",
  pnl_30d: "Last 30 Days",
  total_pnl: "All Time",
};

const formatPnl = (n: number) => {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

// Demo dataset shown when the leaderboard view returns empty.
const DEMO_TRADERS: DemoRow[] = [
  { user_id: "d1", display_name: "IX_Mentor", avatar_url: null, total_trades: 312, total_pnl: 184_320, pnl_30d: 42_180, pnl_7d: 11_240, win_rate: 78, best_trade: 8400, avg_r: 2.4, profit_factor: 3.8, win_streak: 12, followers: 2840, verified: true, badge: "Elite" },
  { user_id: "d2", display_name: "df23fx", avatar_url: null, total_trades: 286, total_pnl: 142_510, pnl_30d: 38_900, pnl_7d: 9_320, win_rate: 71, best_trade: 6200, avg_r: 2.1, profit_factor: 3.2, win_streak: 8, followers: 1920, verified: true, badge: "Pro" },
  { user_id: "d3", display_name: "EUR_King", avatar_url: null, total_trades: 254, total_pnl: 121_800, pnl_30d: 31_450, pnl_7d: 7_810, win_rate: 69, best_trade: 5800, avg_r: 1.9, profit_factor: 2.9, win_streak: 6, followers: 1540, verified: true, badge: "Pro" },
  { user_id: "d4", display_name: "desk-trader", avatar_url: null, total_trades: 198, total_pnl: 92_150, pnl_30d: 24_320, pnl_7d: 6_120, win_rate: 66, best_trade: 4400, avg_r: 1.7, profit_factor: 2.5, win_streak: 5, followers: 980 },
  { user_id: "d5", display_name: "pip_hunter", avatar_url: null, total_trades: 174, total_pnl: 78_420, pnl_30d: 19_800, pnl_7d: 5_240, win_rate: 64, best_trade: 3900, avg_r: 1.6, profit_factor: 2.3, win_streak: 4, followers: 720 },
  { user_id: "d6", display_name: "alpha-rat", avatar_url: null, total_trades: 156, total_pnl: 64_180, pnl_30d: 16_320, pnl_7d: 4_120, win_rate: 62, best_trade: 3400, avg_r: 1.5, profit_factor: 2.1, win_streak: 3, followers: 540 },
  { user_id: "d7", display_name: "scalper.lab", avatar_url: null, total_trades: 412, total_pnl: 58_900, pnl_30d: 14_220, pnl_7d: 3_840, win_rate: 58, best_trade: 1800, avg_r: 1.2, profit_factor: 1.9, win_streak: 7, followers: 480 },
  { user_id: "d8", display_name: "María G.", avatar_url: null, total_trades: 142, total_pnl: 51_320, pnl_30d: 12_900, pnl_7d: 3_410, win_rate: 67, best_trade: 2900, avg_r: 1.7, profit_factor: 2.4, win_streak: 5, followers: 410 },
  { user_id: "d9", display_name: "Jonas K.", avatar_url: null, total_trades: 128, total_pnl: 44_180, pnl_30d: 11_240, pnl_7d: 2_980, win_rate: 63, best_trade: 2700, avg_r: 1.5, profit_factor: 2.1, win_streak: 4, followers: 320 },
  { user_id: "d10", display_name: "Priya R.", avatar_url: null, total_trades: 116, total_pnl: 38_910, pnl_30d: 9_810, pnl_7d: 2_540, win_rate: 61, best_trade: 2400, avg_r: 1.4, profit_factor: 2.0, win_streak: 3, followers: 280 },
];

const PODIUM_STYLES = [
  { gradient: "from-amber-400/30 to-amber-600/10", border: "border-amber-400/50", icon: Crown, label: "1st", iconColor: "text-amber-300", glow: "shadow-[0_0_40px_-10px_hsl(45_100%_50%/0.6)]" },
  { gradient: "from-zinc-300/25 to-zinc-500/10", border: "border-zinc-300/40", icon: Medal, label: "2nd", iconColor: "text-zinc-200", glow: "shadow-[0_0_30px_-12px_hsl(0_0%_70%/0.5)]" },
  { gradient: "from-orange-500/25 to-orange-700/10", border: "border-orange-500/40", icon: Award, label: "3rd", iconColor: "text-orange-300", glow: "shadow-[0_0_30px_-12px_hsl(20_90%_50%/0.5)]" },
];

const initialsOf = (n: string) => n.split(/[\s.]+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

const PodiumCard = ({ row, period, rank }: { row: DemoRow; period: Period; rank: number }) => {
  const style = PODIUM_STYLES[rank];
  const Icon = style.icon;
  const value = row[period] as number;
  const positive = value >= 0;

  const handleFollow = () => toast.success(`Now following ${row.display_name}`);
  const handleCopy = () => toast.success(`Copying trades from ${row.display_name}`);

  return (
    <div
      className={`relative rounded-3xl border bg-gradient-to-b ${style.gradient} ${style.border} ${style.glow} p-5 backdrop-blur-md animate-fade-in`}
      style={{ animationDelay: `${rank * 100}ms`, animationFillMode: "both" }}
    >
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 shadow-lg">
        <Icon className={`h-4 w-4 ${style.iconColor}`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">{style.label}</span>
      </div>

      <div className="mt-2 flex flex-col items-center text-center">
        <div className={`relative mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-card border-2 ${style.border}`}>
          {row.avatar_url ? (
            <img src={row.avatar_url} alt={row.display_name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-foreground">{initialsOf(row.display_name)}</span>
          )}
          {row.verified && (
            <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-card">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <h3 className="font-heading text-base font-bold text-foreground truncate max-w-[180px]">{row.display_name}</h3>
        </div>
        {row.badge && (
          <span className="mt-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {row.badge}
          </span>
        )}

        <div className={`mt-3 flex items-center gap-1 font-mono text-2xl font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          {formatPnl(value)}
        </div>

        <div className="mt-3 grid w-full grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg bg-background/40 px-1.5 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Win</p>
            <p className="font-mono text-xs font-bold text-foreground">{row.win_rate}%</p>
          </div>
          <div className="rounded-lg bg-background/40 px-1.5 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">PF</p>
            <p className="font-mono text-xs font-bold text-foreground">{row.profit_factor.toFixed(1)}</p>
          </div>
          <div className="rounded-lg bg-background/40 px-1.5 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Streak</p>
            <p className="flex items-center justify-center gap-0.5 font-mono text-xs font-bold text-primary">
              <Flame className="h-3 w-3" />
              {row.win_streak}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {row.followers.toLocaleString()} followers
        </div>

        <div className="mt-3 flex w-full gap-1.5">
          <Button size="sm" className="flex-1 h-8 text-[11px] rounded-xl" onClick={handleFollow}>
            Follow
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px] rounded-xl gap-1" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
            Copy
          </Button>
        </div>
      </div>
    </div>
  );
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

  const realRanked = rows.filter((r) => r.total_trades > 0);
  const usingDemo = realRanked.length === 0 && !loading;
  // Re-sort demo dataset by selected period
  const demoSorted = [...DEMO_TRADERS].sort((a, b) => (b[period] as number) - (a[period] as number));
  const ranked: DemoRow[] = usingDemo ? demoSorted : (realRanked as DemoRow[]);

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3, 10);

  const handleFollow = (n: string) => toast.success(`Now following ${n}`);
  const handleCopy = (n: string) => toast.success(`Copying trades from ${n}`);

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO
        title="Trader Leaderboard | Elite Live Trading Room"
        description="Live ranking of community traders by 7-day, 30-day and all-time P&L, win rate and average R."
        canonical="https://elitelivetradingroom.com/leaderboard"
      />
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

      <div className="container max-w-6xl py-10 px-4">
        <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Community</span>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground uppercase tracking-tight">
              Trader <span className="text-gradient">Leaderboard</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Ranked by realized P&L. Follow top performers or copy their trades to your journal automatically.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-2xl border-2 border-border/60 bg-card p-1.5 shadow-lg">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  period === p
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Podium Top 3 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
              {top3.map((r, i) => (
                <PodiumCard key={r.user_id} row={r} period={period} rank={i} />
              ))}
            </div>

            {/* Rest of top 10 */}
            <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-2 border-b border-border/30 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-1">Rank</div>
                <div className="col-span-3">Trader</div>
                <div className="col-span-2 text-right">P&L</div>
                <div className="col-span-1 text-right">Win %</div>
                <div className="col-span-1 text-right">PF</div>
                <div className="col-span-1 text-right">Streak</div>
                <div className="col-span-1 text-right">Followers</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              <div className="divide-y divide-border/30">
                {rest.map((r, idx) => {
                  const value = r[period] as number;
                  const positive = value >= 0;
                  const rank = idx + 4;

                  return (
                    <div
                      key={r.user_id}
                      className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-3.5 items-center transition-colors hover:bg-muted/30 animate-fade-in"
                      style={{ animationDelay: `${idx * 40}ms`, animationFillMode: "both" }}
                    >
                      <div className="hidden md:flex col-span-1 items-center">
                        <span className="font-mono text-sm font-bold text-muted-foreground">#{rank}</span>
                      </div>

                      <div className="col-span-2 md:col-span-3 flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold border border-border/40">
                          {initialsOf(r.display_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">{r.display_name}</p>
                            {(r as DemoRow).verified && (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {r.total_trades} trades · avg {r.avg_r.toFixed(1)}R
                          </p>
                        </div>
                      </div>

                      <div className={`col-span-1 md:col-span-2 text-right font-mono text-sm font-bold flex items-center justify-end gap-1 ${
                        positive ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatPnl(value)}
                      </div>

                      <div className="hidden md:block col-span-1 text-right text-xs text-foreground font-mono">
                        {r.win_rate}%
                      </div>
                      <div className="hidden md:block col-span-1 text-right text-xs text-foreground font-mono">
                        {(r as DemoRow).profit_factor?.toFixed(1) ?? "—"}
                      </div>
                      <div className="hidden md:flex col-span-1 items-center justify-end gap-0.5 text-xs text-primary font-mono">
                        <Flame className="h-3 w-3" />
                        {(r as DemoRow).win_streak ?? 0}
                      </div>
                      <div className="hidden md:flex col-span-1 items-center justify-end gap-0.5 text-xs text-muted-foreground font-mono">
                        <Users className="h-3 w-3" />
                        {((r as DemoRow).followers ?? 0).toLocaleString()}
                      </div>

                      <div className="hidden md:flex col-span-2 justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-[10px] rounded-lg" onClick={() => handleFollow(r.display_name)}>
                          Follow
                        </Button>
                        <Button size="sm" className="h-7 px-2.5 text-[10px] rounded-lg gap-1" onClick={() => handleCopy(r.display_name)}>
                          <Copy className="h-3 w-3" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {usingDemo && (
          <p className="mt-6 text-center text-xs text-muted-foreground/70">
            Showing community sample data. Log a closed trade in your journal to appear here in real time.
          </p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
