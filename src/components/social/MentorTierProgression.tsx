import { useEffect, useState } from "react";
import { ShieldCheck, Crown, Sparkles, Star, GraduationCap, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { computeMentorTier, MENTOR_TIERS } from "@/lib/mentor-tier";

interface TierDef {
  id: keyof typeof MENTOR_TIERS;
  rule: string;
  Icon: typeof ShieldCheck;
  ring: string;
  text: string;
}

const TIERS: TierDef[] = [
  { id: "rising_star",     rule: "20+ trades · 50%+ win rate",                Icon: Star,        ring: "ring-slate-300/40",  text: "text-slate-200" },
  { id: "verified_trader", rule: "50+ trades · 58%+ win rate",                Icon: ShieldCheck, ring: "ring-sky-400/45",    text: "text-sky-300" },
  { id: "mentor",          rule: "120+ trades · 63%+ win · positive P&L",    Icon: Crown,       ring: "ring-[#FFCD05]/50",  text: "text-[#FFCD05]" },
  { id: "elite_mentor",    rule: "250+ trades · 68%+ win rate",               Icon: Sparkles,    ring: "ring-fuchsia-400/45",text: "text-fuchsia-300" },
];

interface Props {
  onApply?: () => void;
  className?: string;
}

const MentorTierProgression = ({ onApply, className = "" }: Props) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ total: number; wr: number; totalPnl: number; pnl30: number } | null>(null);
  const [currentTierId, setCurrentTierId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let off = false;
    (async () => {
      const { data } = await supabase.from("leaderboard_stats")
        .select("total_trades, win_rate, total_pnl, pnl_30d")
        .eq("user_id", user.id).maybeSingle();
      if (off) return;
      const s = {
        total: Number(data?.total_trades ?? 0),
        wr: Number(data?.win_rate ?? 0),
        totalPnl: Number(data?.total_pnl ?? 0),
        pnl30: Number(data?.pnl_30d ?? 0),
      };
      setStats(s);
      const tier = computeMentorTier({ totalTrades: s.total, winRate: s.wr, totalPnl: s.totalPnl, pnl30d: s.pnl30 });
      setCurrentTierId(tier?.id ?? null);
    })();
    return () => { off = true; };
  }, [user]);

  const idxOrder = ["rising_star", "verified_trader", "mentor", "elite_mentor"];
  const currentIdx = currentTierId ? idxOrder.indexOf(currentTierId) : -1;

  return (
    <div className={`rounded-2xl border border-white/10 bg-[#0F0F0F] p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFCD05]/15 text-[#FFCD05] ring-1 ring-[#FFCD05]/30">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-white">
              Mentor Verification
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">
              Earn tiers by trading consistently · admin-approved for Mentor role
            </p>
          </div>
        </div>
        {onApply && (
          <Button size="sm" onClick={onApply} className="bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90 font-semibold gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Apply to become Mentor
          </Button>
        )}
      </div>

      {/* Progression ladder */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        {TIERS.map((t, i) => {
          const reached = currentIdx >= i;
          const Icon = t.Icon;
          return (
            <div key={t.id}
              className={`rounded-xl border bg-[#0A0A0A] p-3 transition-all ${
                reached
                  ? `border-white/15 ring-1 ${t.ring}`
                  : "border-white/5 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ring-1 ${t.ring} ${t.text} bg-white/5`}>
                  <Icon className="h-3 w-3" strokeWidth={2.5} />
                </div>
                {reached ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-white/30" />
                )}
              </div>
              <p className={`font-heading text-[11px] font-bold uppercase tracking-wider ${t.text}`}>
                {MENTOR_TIERS[t.id].label}
              </p>
              <p className="mt-1 font-mono text-[9px] leading-snug text-white/50">
                {t.rule}
              </p>
            </div>
          );
        })}
      </div>

      {/* Your stats */}
      {stats && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-3 font-mono text-[10px] uppercase tracking-wider text-white/40">
          <span>Your stats:</span>
          <span><span className="text-white">{stats.total}</span> trades</span>
          <span><span className="text-white">{stats.wr.toFixed(1)}%</span> win rate</span>
          <span className={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
            {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(0)} all-time P&L
          </span>
        </div>
      )}
    </div>
  );
};

export default MentorTierProgression;
