import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Trophy, TrendingUp, TrendingDown, Crown, Medal, Award,
  Copy, CheckCircle2, Sparkles, GraduationCap, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import MT5StatusBadge from "@/components/MT5StatusBadge";
import { toast } from "sonner";
import MentorTierProgression from "@/components/social/MentorTierProgression";

type PeriodKey = "all" | "month" | "week" | "today";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "month", label: "This Month" },
  { key: "week", label: "This Week" },
  { key: "today", label: "Today" },
];
const PAGE_SIZE = 50;

interface TraderRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_mentor: boolean;
  is_verified: boolean;
  win_rate: number;
  total_pnl: number;
  trades: number;
  wins: number;
  losses: number;
  avg_rr: number;
}

const periodStart = (p: PeriodKey): Date | null => {
  const now = new Date();
  if (p === "today") { const d = new Date(now); d.setHours(0,0,0,0); return d; }
  if (p === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (p === "month") { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
  return null;
};

const initials = (n: string) =>
  n.split(/[\s._-]+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
const fmtMoney = (n: number) => {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const PODIUM = [
  { ring: "ring-[#FFCD05]", text: "text-[#FFCD05]", bg: "from-[#FFCD05]/15 to-transparent", Icon: Crown, label: "1st" },
  { ring: "ring-zinc-300", text: "text-zinc-200", bg: "from-zinc-300/10 to-transparent", Icon: Medal, label: "2nd" },
  { ring: "ring-amber-700", text: "text-amber-500", bg: "from-amber-700/15 to-transparent", Icon: Award, label: "3rd" },
];

// Compute leader rows from real tables for a period
async function fetchLeaders(period: PeriodKey, offset: number, limit: number): Promise<{ rows: TraderRow[]; hasMore: boolean }> {
  const start = periodStart(period);

  // Fetch wider profile base for paging; cap at 500 to keep client work bounded
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .limit(500);

  const userIds = (profiles || []).map((p: any) => p.user_id);
  if (userIds.length === 0) return { rows: [], hasMore: false };

  const [{ data: roles }, { data: journal }, { data: execs }] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
    (() => {
      let q = supabase.from("trade_journal").select("user_id, pnl, r_multiple, closed_at, status").in("user_id", userIds).eq("status", "closed");
      if (start) q = q.gte("closed_at", start.toISOString());
      return q;
    })(),
    (() => {
      let q = supabase.from("trade_execution_logs").select("user_id, status, created_at").in("user_id", userIds);
      if (start) q = q.gte("created_at", start.toISOString());
      return q;
    })(),
  ]);

  const mentorSet = new Set<string>((roles || []).filter((r: any) => r.role === "admin" || r.role === "moderator").map((r: any) => r.user_id));

  const agg = new Map<string, { trades: number; wins: number; losses: number; pnl: number; rSum: number; rCount: number }>();
  (journal || []).forEach((t: any) => {
    const c = agg.get(t.user_id) || { trades: 0, wins: 0, losses: 0, pnl: 0, rSum: 0, rCount: 0 };
    c.trades += 1;
    const pnl = Number(t.pnl) || 0;
    c.pnl += pnl;
    if (pnl > 0) c.wins += 1;
    else if (pnl < 0) c.losses += 1;
    if (t.r_multiple != null) { c.rSum += Number(t.r_multiple); c.rCount += 1; }
    agg.set(t.user_id, c);
  });
  (execs || []).forEach((e: any) => {
    const c = agg.get(e.user_id) || { trades: 0, wins: 0, losses: 0, pnl: 0, rSum: 0, rCount: 0 };
    // Only count exec logs for trade volume if there's no journal entry, else they double-count
    if (!agg.has(e.user_id)) c.trades += 1;
    agg.set(e.user_id, c);
  });

  const MIN_TRADES_TO_RANK = 5;
  const rowsAll: TraderRow[] = (profiles || []).map((p: any) => {
    const a = agg.get(p.user_id) || { trades: 0, wins: 0, losses: 0, pnl: 0, rSum: 0, rCount: 0 };
    const decided = a.wins + a.losses;
    return {
      user_id: p.user_id,
      display_name: p.display_name || "Trader",
      avatar_url: p.avatar_url,
      is_mentor: mentorSet.has(p.user_id),
      is_verified: mentorSet.has(p.user_id),
      win_rate: decided > 0 ? Math.round((a.wins / decided) * 100) : 0,
      total_pnl: Math.round(a.pnl),
      trades: a.trades,
      wins: a.wins,
      losses: a.losses,
      avg_rr: a.rCount > 0 ? +(a.rSum / a.rCount).toFixed(2) : 0,
    };
  });

  // Eligibility: only rank traders with verifiable activity (>= MIN_TRADES_TO_RANK closed trades).
  // Excludes empty/0-trade users from ranking entirely.
  const rows = rowsAll.filter((r) => r.trades >= MIN_TRADES_TO_RANK);

  // Sort: traders with activity first by P&L desc, then by trade count, mentors as tiebreaker
  rows.sort((a, b) => {
    if (b.total_pnl !== a.total_pnl) return b.total_pnl - a.total_pnl;
    if (b.trades !== a.trades) return b.trades - a.trades;
    return Number(b.is_mentor) - Number(a.is_mentor);
  });

  const page = rows.slice(offset, offset + limit);
  return { rows: page, hasMore: rows.length > offset + limit };
}

// TODO(perf): Before restoring Leaderboard to nav, replace this client-side aggregation
// (fetch 500 profiles + journal + execs and reduce in JS) with a server-side view or RPC
// that returns pre-aggregated, eligibility-filtered ranking rows.

const Leaderboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [rows, setRows] = useState<TraderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<TraderRow | null>(null);
  const [mentorOpen, setMentorOpen] = useState(false);

  // load user relationships
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: f }, { data: c }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("copy_subscriptions").select("trader_id, status").eq("subscriber_id", user.id),
      ]);
      setFollows(new Set((f || []).map((r: any) => r.following_id)));
      setCopies(new Set((c || []).filter((r: any) => r.status === "active").map((r: any) => r.trader_id)));
    })();
  }, [user]);

  // initial load on period change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaders(period, 0, PAGE_SIZE).then(({ rows, hasMore }) => {
      if (cancelled) return;
      setRows(rows); setHasMore(hasMore); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [period]);

  const loadMore = async () => {
    setLoadingMore(true);
    const { rows: more, hasMore: hm } = await fetchLeaders(period, rows.length, PAGE_SIZE);
    setRows((prev) => [...prev, ...more]);
    setHasMore(hm);
    setLoadingMore(false);
  };

  const handleFollow = async (trader: TraderRow) => {
    if (!user) { toast.error("Sign in to follow traders"); return; }
    if (user.id === trader.user_id) { toast.error("You cannot follow yourself"); return; }
    if (follows.has(trader.user_id)) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", trader.user_id);
      setFollows((s) => { const n = new Set(s); n.delete(trader.user_id); return n; });
      toast.success(`Unfollowed ${trader.display_name}`);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: trader.user_id });
      if (error) return toast.error(error.message);
      setFollows((s) => new Set(s).add(trader.user_id));
      toast.success(`Now following ${trader.display_name}`);
    }
  };

  const handleCopy = async (trader: TraderRow) => {
    if (!user) { toast.error("Sign in to follow educators"); return; }
    if (user.id === trader.user_id) { toast.error("You cannot follow yourself"); return; }
    if (copies.has(trader.user_id)) {
      await supabase.from("copy_subscriptions").update({ status: "paused" }).eq("subscriber_id", user.id).eq("trader_id", trader.user_id);
      setCopies((s) => { const n = new Set(s); n.delete(trader.user_id); return n; });
      toast.success(`Stopped following ${trader.display_name}`);
    } else {
      const { error } = await supabase.from("copy_subscriptions").upsert(
        { subscriber_id: user.id, trader_id: trader.user_id, status: "active", risk_multiplier: 1.0 },
        { onConflict: "subscriber_id,trader_id" },
      );
      if (error) return toast.error(error.message);
      setCopies((s) => new Set(s).add(trader.user_id));
      toast.success(`Following ${trader.display_name}`);
    }
  };

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="min-h-screen bg-[#050505] text-foreground pb-16 md:pb-0">
      <SEO
        title="Trader Leaderboard | IX Sala de Trading"
        description="Community activity overview based on available educational platform data. Not investment advice."
        canonical="https://ixsalatrading.com/leaderboard"
      />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-white/20">|</span>
            <span className="hidden sm:inline font-heading text-sm font-semibold">
              <span className="text-[#FFCD05]">IX</span> LEADERBOARD
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <MT5StatusBadge className="hidden sm:inline-flex" />
            <Button variant="ghost" size="sm" asChild className="text-white/60 gap-1.5">
              <Link to="/community"><ArrowLeft className="h-4 w-4" /> Community</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-6xl py-8 px-4">
        {/* Compliance disclaimer — required on this page */}
        <div className="mb-6 rounded-2xl border border-[#FFCD05]/30 bg-[#FFCD05]/5 p-4 text-xs leading-relaxed text-white/80">
          <p className="font-semibold text-[#FFCD05] mb-1 uppercase tracking-wider text-[10px]">Educational Disclaimer</p>
          <p>
            Leaderboard data is provided for educational and community purposes only. Rankings are not
            investment advice, financial advice, performance guarantees, or recommendations to follow any
            trader. Past performance does not guarantee future results.
          </p>
        </div>

        {/* Mentor verification + Apply CTA */}
        <div className="mb-6">
          <MentorTierProgression onApply={() => setMentorOpen(true)} />
        </div>

        {/* Title + period tabs */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-[#FFCD05]" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">Community Activity</span>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
              IX <span className="text-[#FFCD05]">Traders</span>
            </h1>
            <p className="mt-1 text-xs text-white/50">
              Community activity overview based on available educational platform data.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0F0F0F] p-1">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`rounded-lg px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  period === p.key ? "bg-[#FFCD05] text-black" : "text-white/50 hover:text-white"
                }`}>{p.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl bg-white/5" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0F0F0F] p-10 text-center">
            <Trophy className="h-8 w-8 mx-auto text-white/30 mb-2" />
            <p className="text-sm text-white/60">
              Leaderboard will be available once there is enough verified community activity.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {top3.map((r, i) => {
                const style = PODIUM[i]; const Icon = style.Icon;
                const positive = r.total_pnl >= 0;
                return (
                  <div key={r.user_id} onClick={() => setDetail(r)}
                    className={`relative rounded-2xl border border-white/10 bg-gradient-to-b ${style.bg} bg-[#0F0F0F] p-4 cursor-pointer hover:border-white/20 transition-colors`}>
                    <div className="absolute -top-2.5 left-4 flex items-center gap-1 rounded-full border border-white/10 bg-[#0F0F0F] px-2 py-0.5">
                      <Icon className={`h-3 w-3 ${style.text}`} />
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${style.text}`}>{style.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar row={r} ring={style.ring} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm text-white truncate">{r.display_name}</p>
                          {r.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-[#FFCD05] shrink-0" />}
                        </div>
                        <p className="text-[10px] uppercase tracking-wider text-white/40">
                          {r.is_mentor ? "Educator" : r.is_verified ? "Verified Community Member" : "Trader"}
                        </p>
                      </div>
                      <div className={`text-right font-mono text-sm font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
                        {positive ? <TrendingUp className="h-3 w-3 inline mr-0.5" /> : <TrendingDown className="h-3 w-3 inline mr-0.5" />}
                        {fmtMoney(r.total_pnl)}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Stat label="Win" value={`${r.win_rate}%`} />
                      <Stat label="Trades" value={String(r.trades)} />
                      <Stat label="Avg R/R" value={r.avg_rr.toFixed(2)} />
                    </div>
                    <div className="mt-3 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" onClick={() => handleFollow(r)}
                        className={`flex-1 h-7 text-[10px] font-semibold ${follows.has(r.user_id) ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90"}`}>
                        {follows.has(r.user_id) ? "Following" : "Follow"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCopy(r)}
                        className={`flex-1 h-7 text-[10px] gap-1 ${copies.has(r.user_id) ? "border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[#FFCD05] hover:bg-[#FFCD05]/15" : "border-white/15 bg-transparent text-white hover:bg-white/5"}`}>
                        <Copy className="h-3 w-3" /> {copies.has(r.user_id) ? "Following" : "Follow Educator"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0F0F0F] overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-2 border-b border-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/40">
                <div className="col-span-1">Rank</div>
                <div className="col-span-3">Trader</div>
                <div className="col-span-1 text-right">Win %</div>
                <div className="col-span-2 text-right">Total P&L</div>
                <div className="col-span-1 text-right">Trades</div>
                <div className="col-span-2 text-right">Avg R/R</div>
                <div className="col-span-2 text-right">Action</div>
              </div>
              <div className="divide-y divide-white/5">
                {rest.map((r, idx) => {
                  const rank = idx + 4;
                  const positive = r.total_pnl >= 0;
                  return (
                    <div key={r.user_id} onClick={() => setDetail(r)}
                      className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/[0.04] cursor-pointer transition-colors">
                      <div className="hidden md:flex col-span-1 items-center">
                        <span className="font-mono text-sm font-bold text-white/50">#{rank}</span>
                      </div>
                      <div className="col-span-2 md:col-span-3 flex items-center gap-3 min-w-0">
                        <Avatar row={r} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-semibold text-white truncate">{r.display_name}</p>
                            {r.is_verified && <CheckCircle2 className="h-3 w-3 text-[#FFCD05] shrink-0" />}
                          </div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40">
                            {r.is_mentor ? "Educator" : r.is_verified ? "Verified Community Member" : "Trader"}
                          </p>
                        </div>
                      </div>
                      <div className="hidden md:block col-span-1 text-right font-mono text-xs text-white/80">{r.win_rate}%</div>
                      <div className={`col-span-2 text-right font-mono text-sm font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
                        {fmtMoney(r.total_pnl)}
                      </div>
                      <div className="hidden md:block col-span-1 text-right font-mono text-xs text-white/60">{r.trades}</div>
                      <div className="hidden md:block col-span-2 text-right font-mono text-xs text-white/80">{r.avg_rr.toFixed(2)}</div>
                      <div className="col-span-2 flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" onClick={() => handleFollow(r)}
                          className={`h-7 text-[10px] font-semibold px-3 ${follows.has(r.user_id) ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90"}`}>
                          {follows.has(r.user_id) ? "Following" : "Follow"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCopy(r)}
                          className={`h-7 text-[10px] px-2.5 gap-1 ${copies.has(r.user_id) ? "border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[#FFCD05] hover:bg-[#FFCD05]/15" : "border-white/15 bg-transparent text-white hover:bg-white/5"}`}>
                          <Copy className="h-3 w-3" /> {copies.has(r.user_id) ? "Following" : "Follow Educator"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button onClick={loadMore} disabled={loadingMore} variant="outline"
                  className="border-white/15 bg-transparent text-white hover:bg-white/5">
                  {loadingMore ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Loading…</> : "Load more traders"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <TraderDetail trader={detail} onClose={() => setDetail(null)} period={period}
        following={detail ? follows.has(detail.user_id) : false}
        copying={detail ? copies.has(detail.user_id) : false}
        onFollow={() => detail && handleFollow(detail)}
        onCopy={() => detail && handleCopy(detail)} />

      <MentorApplyDialog open={mentorOpen} onOpenChange={setMentorOpen} userId={user?.id} />
    </div>
  );
};

const Avatar = ({ row, ring, size }: { row: TraderRow; ring?: string; size?: "sm" }) => {
  const dim = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const ringCls = ring ? `ring-2 ${ring}` : "border border-white/10";
  return (
    <div className={`relative ${dim} shrink-0 rounded-full bg-[#1a1a1a] ${ringCls} flex items-center justify-center overflow-hidden`}>
      {row.avatar_url
        ? <img src={row.avatar_url} alt={row.display_name} className="h-full w-full object-cover" />
        : <span className="text-[11px] font-bold text-white">{initials(row.display_name)}</span>}
      {row.is_mentor && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFCD05] text-black border-2 border-[#0F0F0F]">
          <GraduationCap className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
    <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    <p className="font-mono text-xs font-bold text-white">{value}</p>
  </div>
);

// ---------- Trader Detail Drawer ----------
const TraderDetail = ({ trader, onClose, period, following, copying, onFollow, onCopy }:
  { trader: TraderRow | null; onClose: () => void; period: PeriodKey; following: boolean; copying: boolean; onFollow: () => void; onCopy: () => void; }) => {
  const [breakdown, setBreakdown] = useState<{ all: number; month: number; week: number; today: number } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trader) return;
    setLoading(true);
    (async () => {
      const { data: trades } = await supabase
        .from("trade_journal")
        .select("pair, direction, pnl, r_multiple, closed_at, status, opened_at, entry_price, exit_price")
        .eq("user_id", trader.user_id)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(500);

      const now = Date.now();
      const dayMs = 86400000;
      const sums = { all: 0, month: 0, week: 0, today: 0 };
      (trades || []).forEach((t: any) => {
        const pnl = Number(t.pnl) || 0;
        sums.all += pnl;
        if (!t.closed_at) return;
        const age = now - new Date(t.closed_at).getTime();
        if (age <= 30 * dayMs) sums.month += pnl;
        if (age <= 7 * dayMs) sums.week += pnl;
        const today0 = new Date(); today0.setHours(0,0,0,0);
        if (new Date(t.closed_at).getTime() >= today0.getTime()) sums.today += pnl;
      });
      setBreakdown(sums);
      setRecent((trades || []).slice(0, 10));
      setLoading(false);
    })();
  }, [trader]);

  return (
    <Sheet open={!!trader} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-[#0A0A0A] border-l border-white/10 text-white overflow-y-auto">
        {trader && (
          <>
            <SheetHeader>
              <SheetTitle className="text-white">Trader Details</SheetTitle>
            </SheetHeader>

            <div className="mt-4 flex items-center gap-3">
              <Avatar row={trader} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-base text-white truncate">{trader.display_name}</p>
                  {trader.is_verified && <CheckCircle2 className="h-4 w-4 text-[#FFCD05]" />}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  {trader.is_mentor ? "Educator" : trader.is_verified ? "Verified Community Member" : "Trader"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={onFollow} size="sm"
                className={`flex-1 ${following ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90"}`}>
                {following ? "Following" : "Follow"}
              </Button>
              <Button onClick={onCopy} size="sm" variant="outline"
                className={`flex-1 gap-1 ${copying ? "border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[#FFCD05]" : "border-white/15 bg-transparent text-white hover:bg-white/5"}`}>
                <Copy className="h-3.5 w-3.5" /> {copying ? "Following" : "Follow Educator"}
              </Button>
            </div>

            {/* Win rate breakdown */}
            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Win Rate Breakdown</p>
              <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">Overall</span>
                  <span className="font-mono text-sm font-bold text-white">{trader.win_rate}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-[#FFCD05]" style={{ width: `${trader.win_rate}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Wins" value={String(trader.wins)} />
                  <Stat label="Losses" value={String(trader.losses)} />
                  <Stat label="Avg R/R" value={trader.avg_rr.toFixed(2)} />
                </div>
              </div>
            </div>

            {/* P&L by period */}
            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">P&L by Period</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: "today", label: "Today" },
                  { k: "week", label: "7d" },
                  { k: "month", label: "30d" },
                  { k: "all", label: "All Time" },
                ].map((p) => {
                  const v = breakdown ? (breakdown as any)[p.k] : 0;
                  const pos = v >= 0;
                  return (
                    <div key={p.k} className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">{p.label}</p>
                      <p className={`font-mono text-base font-bold ${pos ? "text-emerald-400" : "text-red-400"}`}>
                        {loading ? "…" : fmtMoney(v)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent trades */}
            <div className="mt-5 mb-6">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Recent Trades</p>
              <div className="rounded-xl border border-white/10 bg-[#0F0F0F] divide-y divide-white/5">
                {loading ? (
                  <div className="p-4 text-center text-xs text-white/40">Loading…</div>
                ) : recent.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/40">No closed trades yet</div>
                ) : recent.map((t, i) => {
                  const pnl = Number(t.pnl) || 0;
                  const pos = pnl >= 0;
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white">{t.pair} · <span className={t.direction === "buy" ? "text-emerald-400" : "text-red-400"}>{t.direction?.toUpperCase()}</span></p>
                        <p className="text-[10px] text-white/40">{t.closed_at ? new Date(t.closed_at).toLocaleDateString() : "—"}</p>
                      </div>
                      <div className={`font-mono text-xs font-bold ${pos ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(pnl)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ---------- Mentor Application Dialog ----------
const MentorApplyDialog = ({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId?: string }) => {
  const [fullName, setFullName] = useState("");
  const [years, setYears] = useState("");
  const [style, setStyle] = useState("");
  const [pairs, setPairs] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<null | "approved" | "pending" | "error">(null);
  const [existing, setExisting] = useState<any>(null);

  useEffect(() => {
    if (!open || !userId) return;
    setStatus(null);
    (async () => {
      const { data } = await supabase.from("mentor_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setExisting(data);
        setFullName(data.full_name || "");
        setYears(String(data.experience_years || ""));
        setStyle(data.trading_style || "");
        setPairs(data.pairs || "");
        setBio(data.bio || "");
        setStatus(data.status === "approved" ? "approved" : "pending");
      } else {
        setExisting(null);
      }
    })();
  }, [open, userId]);

  const submit = async () => {
    if (!userId) { toast.error("Sign in first"); return; }
    if (!fullName.trim() || !bio.trim()) { toast.error("Name and bio are required"); return; }
    if (bio.length > 1000) { toast.error("Bio must be under 1000 chars"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("mentor_applications").insert({
      user_id: userId,
      full_name: fullName.trim().slice(0, 100),
      experience_years: Math.max(0, Math.min(60, parseInt(years || "0") || 0)),
      trading_style: style.trim().slice(0, 100) || null,
      pairs: pairs.trim().slice(0, 200) || null,
      bio: bio.trim(),
      status: "pending",
    });
    setSubmitting(false);
    if (error) { setStatus("error"); toast.error(error.message); return; }
    setStatus("pending");
    toast.success("Application submitted — pending admin review");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2"><GraduationCap className="h-4 w-4 text-[#FFCD05]" /> Become an Educator</DialogTitle>
          <DialogDescription className="text-white/50 text-xs">
            Submit your application. An admin will review and approve educators manually.
          </DialogDescription>
        </DialogHeader>

        {status === "approved" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Your application has been approved — you are now an Educator.
          </div>
        )}
        {status === "pending" && (
          <div className="rounded-xl border border-[#FFCD05]/30 bg-[#FFCD05]/10 p-3 text-sm text-[#FFCD05] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Application pending — an admin will review it shortly.
          </div>
        )}
        {status === "error" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            Submission failed. Please try again.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-white/60">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100}
              className="bg-[#0F0F0F] border-white/10 text-white" placeholder="Jane Trader" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-white/60">Years trading</Label>
              <Input type="number" value={years} onChange={(e) => setYears(e.target.value)} min={0} max={60}
                className="bg-[#0F0F0F] border-white/10 text-white" placeholder="5" />
            </div>
            <div>
              <Label className="text-xs text-white/60">Style</Label>
              <Input value={style} onChange={(e) => setStyle(e.target.value)} maxLength={100}
                className="bg-[#0F0F0F] border-white/10 text-white" placeholder="Swing, ICT" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-white/60">Pairs / markets</Label>
            <Input value={pairs} onChange={(e) => setPairs(e.target.value)} maxLength={200}
              className="bg-[#0F0F0F] border-white/10 text-white" placeholder="EURUSD, XAUUSD, NAS100" />
          </div>
          <div>
            <Label className="text-xs text-white/60">Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={4}
              className="bg-[#0F0F0F] border-white/10 text-white" placeholder="Tell the community about your edge…" />
            <p className="mt-1 text-[10px] text-white/30 text-right">{bio.length}/1000</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/15 bg-transparent text-white hover:bg-white/5">Close</Button>
          <Button onClick={submit} disabled={submitting || status === "pending" || status === "approved"} className="bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90 font-semibold">
            {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Submitting…</> : status === "approved" ? "Approved" : status === "pending" ? "Pending Review" : "Submit Application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Leaderboard;
