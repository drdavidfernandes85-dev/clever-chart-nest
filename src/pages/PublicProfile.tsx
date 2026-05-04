import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import FollowButton from "@/components/social/FollowButton";
import infinoxLogo from "@/assets/infinox-logo-white.png";

interface PublicProfileData {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_pnl: number | null;
  win_rate: number | null;
  total_trades: number | null;
}

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [xp, setXp] = useState<{ total_xp: number; level: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: stat }, { count: followers }, { count: followingC }, { data: xpRow }] =
        await Promise.all([
          supabase
            .from("leaderboard_stats")
            .select("user_id, display_name, avatar_url, total_pnl, win_rate, total_trades")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("follows" as any)
            .select("*", { count: "exact", head: true })
            .eq("following_id", userId),
          supabase
            .from("follows" as any)
            .select("*", { count: "exact", head: true })
            .eq("follower_id", userId),
          supabase
            .from("user_xp")
            .select("total_xp, level")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);
      if (stat) {
        setProfile(stat as PublicProfileData);
      } else {
        // Fallback to plain profile
        const { data: p } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .eq("user_id", userId)
          .maybeSingle();
        if (p) setProfile({ ...p, total_pnl: null, win_rate: null, total_trades: null } as PublicProfileData);
      }
      setFollowerCount(followers ?? 0);
      setFollowingCount(followingC ?? 0);
      setXp(xpRow as any);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
        <p className="text-foreground">Profile not found.</p>
        <Link to="/leaderboard"><Button variant="outline">Back to leaderboard</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO
        title={`${profile.display_name} | IX Sala de Trading`}
        description={`Trader profile for ${profile.display_name} on IX Sala de Trading`}
      />
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
          </Link>
          <Link to="/leaderboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-primary/40 bg-primary/15">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-primary">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground uppercase">
              {profile.display_name}
            </h1>
            {xp && (
              <p className="mt-1 text-sm text-muted-foreground">
                Level <span className="font-bold text-primary">{xp.level}</span> · {xp.total_xp.toLocaleString()} XP
              </p>
            )}
          </div>
          <FollowButton targetUserId={profile.user_id} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Followers" value={followerCount.toString()} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Following" value={followingCount.toString()} />
          <StatCard
            icon={<Trophy className="h-4 w-4" />}
            label="Win rate"
            value={profile.win_rate != null ? `${profile.win_rate.toFixed(0)}%` : "—"}
          />
          <StatCard
            icon={<Trophy className="h-4 w-4" />}
            label="Trades"
            value={profile.total_trades?.toString() ?? "0"}
          />
        </div>

        {profile.total_pnl != null && (
          <div className="rounded-2xl border border-border/40 bg-card p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total P&L</p>
            <p className={`mt-2 font-heading text-3xl font-bold ${profile.total_pnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {profile.total_pnl >= 0 ? "+" : ""}${profile.total_pnl.toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl border border-border/40 bg-card p-3">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </div>
    <p className="mt-1 font-heading text-lg font-bold text-foreground">{value}</p>
  </div>
);

export default PublicProfile;
