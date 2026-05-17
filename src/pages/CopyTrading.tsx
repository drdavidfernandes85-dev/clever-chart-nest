import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Copy, Users, TrendingUp, TrendingDown, Loader2, Inbox,
  CheckCircle2, XCircle, Clock, ExternalLink, UserMinus, PauseCircle, PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import MT5StatusBadge from "@/components/MT5StatusBadge";
import { toast } from "sonner";

interface CopiedOrder {
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

interface MentorRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_mentor: boolean;
  copy_status?: "active" | "paused";
  risk_multiplier?: number;
}

const initials = (n: string) =>
  n.split(/[\s._-]+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

const statusPill = (s: string) => {
  if (s === "executed") return { icon: <CheckCircle2 className="h-3 w-3" />, label: "Executed", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (s === "failed") return { icon: <XCircle className="h-3 w-3" />, label: "Failed", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (s === "sent") return { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Sending", cls: "bg-[#FFCD05]/15 text-[#FFCD05] border-[#FFCD05]/30" };
  return { icon: <Clock className="h-3 w-3" />, label: "Queued", cls: "bg-white/5 text-white/60 border-white/15" };
};

const CopyTrading = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CopiedOrder[]>([]);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [following, setFollowing] = useState<MentorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trades" | "mentors">("trades");

  const loadAll = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // Active copied trades
    const { data: o } = await supabase
      .from("mt_pending_orders")
      .select("id, symbol, side, volume, status, ea_ticket, ea_message, signal_id, created_at, executed_at")
      .eq("user_id", user.id)
      .not("signal_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    // Copy subscriptions
    const { data: subs } = await supabase
      .from("copy_subscriptions")
      .select("trader_id, status, risk_multiplier")
      .eq("subscriber_id", user.id);

    // Followed users
    const { data: foll } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const mentorIds = Array.from(new Set((subs || []).map((s: any) => s.trader_id)));
    const followIds = Array.from(new Set((foll || []).map((f: any) => f.following_id)));
    const allIds = Array.from(new Set([...mentorIds, ...followIds]));

    let profileMap = new Map<string, any>();
    let roleSet = new Set<string>();
    if (allIds.length) {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", allIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", allIds),
      ]);
      (ps || []).forEach((p: any) => profileMap.set(p.user_id, p));
      (rs || []).forEach((r: any) => { if (r.role === "admin" || r.role === "moderator") roleSet.add(r.user_id); });
    }

    const subMap = new Map<string, any>();
    (subs || []).forEach((s: any) => subMap.set(s.trader_id, s));

    setMentors(mentorIds.map((id) => {
      const p = profileMap.get(id) || {};
      const s = subMap.get(id);
      return {
        user_id: id,
        display_name: p.display_name || "Trader",
        avatar_url: p.avatar_url || null,
        is_mentor: roleSet.has(id),
        copy_status: s?.status === "active" ? "active" : "paused",
        risk_multiplier: Number(s?.risk_multiplier ?? 1),
      };
    }));

    setFollowing(followIds.map((id) => {
      const p = profileMap.get(id) || {};
      return {
        user_id: id,
        display_name: p.display_name || "Trader",
        avatar_url: p.avatar_url || null,
        is_mentor: roleSet.has(id),
      };
    }));

    setOrders((o || []) as CopiedOrder[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    if (!user) return;
    const channel = supabase
      .channel(`copy-trading-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mt_pending_orders", filter: `user_id=eq.${user.id}` }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const togglePauseMentor = async (m: MentorRow) => {
    if (!user) return;
    const newStatus = m.copy_status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("copy_subscriptions")
      .update({ status: newStatus })
      .eq("subscriber_id", user.id)
      .eq("trader_id", m.user_id);
    if (error) return toast.error(error.message);
    toast.success(newStatus === "active" ? `Resumed copying ${m.display_name}` : `Paused copying ${m.display_name}`);
    loadAll();
  };

  const stopCopyMentor = async (m: MentorRow) => {
    if (!user) return;
    const { error } = await supabase
      .from("copy_subscriptions")
      .delete()
      .eq("subscriber_id", user.id)
      .eq("trader_id", m.user_id);
    if (error) return toast.error(error.message);
    toast.success(`Stopped copying ${m.display_name}`);
    loadAll();
  };

  const unfollow = async (m: MentorRow) => {
    if (!user) return;
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", m.user_id);
    if (error) return toast.error(error.message);
    toast.success(`Unfollowed ${m.display_name}`);
    loadAll();
  };

  const activeOrders = orders.filter((o) => o.status !== "failed");

  return (
    <div className="min-h-screen bg-[#050505] text-foreground pb-16 md:pb-0">
      <SEO
        title="Copy Trading | IX Sala de Trading"
        description="Manage your copied trades and followed mentors."
        canonical="https://ixsalatrading.com/copy-trading"
      />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-white/20">|</span>
            <span className="hidden sm:inline font-heading text-sm font-semibold">
              <span className="text-[#FFCD05]">IX</span> COPY TRADING
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

      <div className="container max-w-5xl py-8 px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Copy className="h-4 w-4 text-[#FFCD05]" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">Copy Trading Hub</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
            My <span className="text-[#FFCD05]">Copy Trades</span>
          </h1>
          <p className="mt-1.5 text-sm text-white/50 max-w-xl">
            Track positions you copied from mentors and manage who you follow or copy automatically.
          </p>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Tile label="Active copied trades" value={String(activeOrders.filter(o => o.status === "sent" || o.status === "pending").length)} icon={<Loader2 className="h-3.5 w-3.5" />} />
          <Tile label="Executed total" value={String(orders.filter(o => o.status === "executed").length)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} accent="green" />
          <Tile label="Mentors copied" value={String(mentors.filter(m => m.copy_status === "active").length)} icon={<Copy className="h-3.5 w-3.5" />} accent="yellow" />
          <Tile label="Following" value={String(following.length)} icon={<Users className="h-3.5 w-3.5" />} />
        </div>

        {/* Tabs */}
        <div className="mb-4 flex items-center gap-1 rounded-xl border border-white/10 bg-[#0F0F0F] p-1 w-fit">
          {([
            { k: "trades", label: "Copied Trades" },
            { k: "mentors", label: "Followed Mentors" },
          ] as const).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`rounded-lg px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                tab === t.k ? "bg-[#FFCD05] text-black" : "text-white/50 hover:text-white"
              }`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-white/40 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tab === "trades" ? (
          orders.length === 0 ? (
            <EmptyState
              title="No copied trades yet"
              body="Tap COPY TRADE on any mentor signal in the Community Hub or Trade Ideas page to get started."
              cta={{ to: "/community", label: "Open Community Hub" }}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0F0F0F] overflow-hidden">
              <ul className="divide-y divide-white/5">
                {orders.map((o) => {
                  const isBuy = o.side === "buy";
                  const badge = statusPill(o.status);
                  return (
                    <li key={o.id} className="px-4 py-3 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {isBuy ? <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" /> : <TrendingDown className="h-4 w-4 text-red-400 shrink-0" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-heading text-sm font-bold text-white tabular-nums">{o.symbol}</p>
                              <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">{o.volume.toFixed(2)} lots</span>
                              <span className={`font-mono text-[9px] uppercase tracking-wider ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                                {o.side}
                              </span>
                            </div>
                            <p className="font-mono text-[10px] text-white/40 mt-0.5">
                              {new Date(o.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              {o.ea_ticket && o.ea_ticket !== "0" && <span className="ml-2 text-[#FFCD05]">#{o.ea_ticket}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-wider font-bold ${badge.cls}`}>
                            {badge.icon}{badge.label}
                          </span>
                        </div>
                      </div>
                      {o.status === "failed" && o.ea_message && (
                        <p className="font-mono text-[10px] text-red-400/80 mt-1.5 pl-7 leading-snug">{o.ea_message}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : (
          <div className="space-y-6">
            <Section title="Mentors I'm copying" count={mentors.length}>
              {mentors.length === 0 ? (
                <EmptyInline body="You aren't copying any mentors yet. Use the Copy button in the Leaderboard." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mentors.map((m) => (
                    <MentorCard key={m.user_id} m={m}
                      onTogglePause={() => togglePauseMentor(m)}
                      onStop={() => stopCopyMentor(m)} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Following" count={following.length}>
              {following.length === 0 ? (
                <EmptyInline body="You aren't following any traders yet." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {following.map((m) => (
                    <MentorCard key={m.user_id} m={m} onUnfollow={() => unfollow(m)} />
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
};

const Tile = ({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: "yellow" | "green" }) => {
  const accentCls = accent === "yellow" ? "text-[#FFCD05]" : accent === "green" ? "text-emerald-400" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3">
      <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-wider">
        {icon}<span>{label}</span>
      </div>
      <p className={`mt-1 font-heading text-xl font-bold tabular-nums ${accentCls}`}>{value}</p>
    </div>
  );
};

const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-white/70">{title}</h2>
      <span className="font-mono text-[10px] text-white/40">{count}</span>
    </div>
    {children}
  </div>
);

const MentorCard = ({ m, onTogglePause, onStop, onUnfollow }:
  { m: MentorRow; onTogglePause?: () => void; onStop?: () => void; onUnfollow?: () => void }) => {
  const isCopying = !!onTogglePause;
  const paused = m.copy_status === "paused";
  return (
    <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3 flex items-center gap-3">
      <div className="relative h-10 w-10 shrink-0 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center overflow-hidden">
        {m.avatar_url
          ? <img src={m.avatar_url} alt={m.display_name} className="h-full w-full object-cover" />
          : <span className="text-[11px] font-bold text-white">{initials(m.display_name)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{m.display_name}</p>
        <p className="text-[10px] uppercase tracking-wider text-white/40">
          {m.is_mentor ? "Mentor" : "Trader"}
          {isCopying && m.risk_multiplier && ` · ${m.risk_multiplier}x risk`}
          {isCopying && paused && " · Paused"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/50 hover:text-white">
          <Link to={`/u/${m.user_id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
        </Button>
        {isCopying && (
          <>
            <Button size="sm" variant="outline" onClick={onTogglePause}
              className="h-7 px-2 text-[10px] border-white/15 bg-transparent text-white hover:bg-white/5 gap-1">
              {paused ? <><PlayCircle className="h-3 w-3" /> Resume</> : <><PauseCircle className="h-3 w-3" /> Pause</>}
            </Button>
            <Button size="sm" variant="outline" onClick={onStop}
              className="h-7 px-2 text-[10px] border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 gap-1">
              <XCircle className="h-3 w-3" /> Stop
            </Button>
          </>
        )}
        {onUnfollow && (
          <Button size="sm" variant="outline" onClick={onUnfollow}
            className="h-7 px-2 text-[10px] border-white/15 bg-transparent text-white hover:bg-white/5 gap-1">
            <UserMinus className="h-3 w-3" /> Unfollow
          </Button>
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ title, body, cta }: { title: string; body: string; cta?: { to: string; label: string } }) => (
  <div className="rounded-2xl border border-white/10 bg-[#0F0F0F] p-10 text-center">
    <Inbox className="h-8 w-8 mx-auto text-white/30 mb-3" />
    <p className="text-sm font-semibold text-white">{title}</p>
    <p className="mt-1 text-xs text-white/50 max-w-sm mx-auto">{body}</p>
    {cta && (
      <Button asChild className="mt-4 bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90 font-semibold">
        <Link to={cta.to}>{cta.label}</Link>
      </Button>
    )}
  </div>
);

const EmptyInline = ({ body }: { body: string }) => (
  <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-6 text-center text-xs text-white/50">{body}</div>
);

export default CopyTrading;
