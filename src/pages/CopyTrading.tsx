import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Copy, Users, TrendingUp, TrendingDown, Loader2, Inbox,
  CheckCircle2, XCircle, Clock, ExternalLink, UserMinus, PauseCircle, PlayCircle,
  Target, Shield, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import MT5StatusBadge from "@/components/MT5StatusBadge";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import CopiedTradesPerformance from "@/components/copytrade/CopiedTradesPerformance";
import MentorTierProgression from "@/components/social/MentorTierProgression";

interface CopiedOrder {
  id: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  ea_ticket: string | null;
  ea_message: string | null;
  signal_id: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  created_at: string;
  executed_at: string | null;
}

interface ExecLogRow {
  id: string;
  created_at: string;
  status: string;
  classification: string | null;
  retcode_description: string | null;
  error_message: string | null;
  ticket: string | null;
  http_status: number | null;
}

interface PositionRow {
  ticket: string;
  symbol: string;
  side: string;
  volume: number;
  open_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number | null;
  commission: number | null;
  swap: number | null;
  opened_at: string;
}

interface MentorRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_mentor: boolean;
  is_following: boolean;
  copy_status?: "active" | "paused" | null;
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

const fmt = (n: number | null | undefined, digits = 5) =>
  n == null || !isFinite(Number(n)) ? "—" : Number(n).toFixed(digits);
const money = (n: number | null | undefined) =>
  n == null || !isFinite(Number(n)) ? "—" : `${Number(n) >= 0 ? "+" : ""}$${Number(n).toFixed(2)}`;

const CopyTrading = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CopiedOrder[]>([]);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trades" | "mentors">("trades");
  const [openTrade, setOpenTrade] = useState<CopiedOrder | null>(null);
  const [openTradeLogs, setOpenTradeLogs] = useState<ExecLogRow[]>([]);
  const [openTradePosition, setOpenTradePosition] = useState<PositionRow | null>(null);
  const [openTradeLoading, setOpenTradeLoading] = useState(false);
  const [openSignal, setOpenSignal] = useState<{ entry_price: number; stop_loss: number | null; take_profit: number | null; status: string; mentor_name: string } | null>(null);

  const loadAll = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const { data: o } = await supabase
      .from("mt_pending_orders")
      .select("id, symbol, side, volume, status, ea_ticket, ea_message, signal_id, entry_price, stop_loss, take_profit, created_at, executed_at")
      .eq("user_id", user.id)
      .not("signal_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: subs } = await supabase
      .from("copy_subscriptions")
      .select("trader_id, status, risk_multiplier")
      .eq("subscriber_id", user.id);

    const { data: foll } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const subMap = new Map<string, any>();
    (subs || []).forEach((s: any) => subMap.set(s.trader_id, s));
    const followSet = new Set<string>((foll || []).map((f: any) => f.following_id));
    const allIds = Array.from(new Set([...subMap.keys(), ...followSet]));

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

    const rows: MentorRow[] = allIds.map((id) => {
      const p = profileMap.get(id) || {};
      const s = subMap.get(id);
      return {
        user_id: id,
        display_name: p.display_name || "Trader",
        avatar_url: p.avatar_url || null,
        is_mentor: roleSet.has(id),
        is_following: followSet.has(id),
        copy_status: s ? (s.status === "active" ? "active" : "paused") : null,
        risk_multiplier: s ? Number(s.risk_multiplier ?? 1) : undefined,
      };
    });
    rows.sort((a, b) => Number(!!b.copy_status) - Number(!!a.copy_status));

    setMentors(rows);
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

  // Load execution log + position details when a trade row is opened.
  useEffect(() => {
    if (!openTrade || !user) {
      setOpenTradeLogs([]); setOpenTradePosition(null); setOpenSignal(null); return;
    }
    let cancelled = false;
    (async () => {
      setOpenTradeLoading(true);
      const [{ data: logs }, { data: pos }] = await Promise.all([
        supabase
          .from("trade_execution_logs")
          .select("id, created_at, status, classification, retcode_description, error_message, ticket, http_status")
          .eq("user_id", user.id)
          .eq("signal_id", openTrade.signal_id || "")
          .order("created_at", { ascending: false })
          .limit(20),
        Promise.resolve({ data: null }), // mt_positions removed

      ]);
      if (cancelled) return;
      setOpenTradeLogs((logs || []) as ExecLogRow[]);
      setOpenTradePosition((pos || null) as PositionRow | null);

      // Fetch the original mentor signal for performance comparison.
      if (openTrade.signal_id) {
        const { data: sig } = await supabase.from("trading_signals")
          .select("entry_price, stop_loss, take_profit, status, author_id")
          .eq("id", openTrade.signal_id).maybeSingle();
        if (sig) {
          let mentorName = "Mentor";
          if (sig.author_id) {
            const { data: prof } = await supabase.from("profiles")
              .select("display_name").eq("user_id", sig.author_id).maybeSingle();
            mentorName = prof?.display_name || "Mentor";
          }
          if (!cancelled) setOpenSignal({
            entry_price: Number(sig.entry_price),
            stop_loss: sig.stop_loss != null ? Number(sig.stop_loss) : null,
            take_profit: sig.take_profit != null ? Number(sig.take_profit) : null,
            status: sig.status,
            mentor_name: mentorName,
          });
        } else if (!cancelled) {
          setOpenSignal(null);
        }
      }
      setOpenTradeLoading(false);
    })();
    return () => { cancelled = true; };
  }, [openTrade, user]);

  const togglePauseMentor = async (m: MentorRow) => {
    if (!user) return;
    const newStatus = m.copy_status === "active" ? "paused" : "active";
    const { error } = await supabase.from("copy_subscriptions")
      .update({ status: newStatus })
      .eq("subscriber_id", user.id).eq("trader_id", m.user_id);
    if (error) return toast.error(error.message);
    toast.success(newStatus === "active" ? `Resumed following ${m.display_name}` : `Paused following ${m.display_name}`);
    loadAll();
  };

  const stopCopyMentor = async (m: MentorRow) => {
    if (!user) return;
    const { error } = await supabase.from("copy_subscriptions")
      .delete().eq("subscriber_id", user.id).eq("trader_id", m.user_id);
    if (error) return toast.error(error.message);
    toast.success(`Stopped following ${m.display_name}`);
    loadAll();
  };

  const startCopyMentor = async (m: MentorRow) => {
    if (!user) return;
    const { error } = await supabase.from("copy_subscriptions")
      .insert({ subscriber_id: user.id, trader_id: m.user_id, status: "active", risk_multiplier: 1.0 });
    if (error) return toast.error(error.message);
    toast.success(`Now following ${m.display_name}`);
    loadAll();
  };

  const toggleFollow = async (m: MentorRow) => {
    if (!user) return;
    if (m.is_following) {
      const { error } = await supabase.from("follows")
        .delete().eq("follower_id", user.id).eq("following_id", m.user_id);
      if (error) return toast.error(error.message);
      toast.success(`Unfollowed ${m.display_name}`);
    } else {
      const { error } = await supabase.from("follows")
        .insert({ follower_id: user.id, following_id: m.user_id });
      if (error) return toast.error(error.message);
      toast.success(`Following ${m.display_name}`);
    }
    loadAll();
  };

  const activeOrders = orders.filter((o) => o.status !== "failed");
  const copyingCount = mentors.filter(m => m.copy_status === "active").length;

  // P&L by period (executed orders only — closed P&L = ea_message numbers if present, otherwise from related position)
  const periodPnl = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const buckets = { today: 0, week: 0, month: 0, all: 0 };
    // We don't have closed pnl on mt_pending_orders; surface open position profit when present.
    // For aggregated P&L we sum position.profit per ticket later — keep this simple here.
    return buckets;
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-foreground pb-16 md:pb-0">
      <SEO
        title="Idea Tools | IX Trading Room"
        description="Manage your reviewed market ideas and followed educators."
        canonical="https://ixsalatrading.com/copy-trading"
      />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-white/20">|</span>
            <span className="hidden sm:inline font-heading text-sm font-semibold">
              <span className="text-[#FFCD05]">IX</span> TRADING ROOM
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
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">Idea Tools</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
            My <span className="text-[#FFCD05]">Reviewed Ideas</span>
          </h1>
          <p className="mt-1.5 text-sm text-white/50 max-w-xl">
            Track educational market ideas you have reviewed and manage the educators you follow. Every order is user-controlled. Powered by Trading Layer.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Tile label="Active reviewed ideas" value={String(activeOrders.filter(o => o.status === "sent" || o.status === "pending").length)} icon={<Loader2 className="h-3.5 w-3.5" />} />
          <Tile label="Executed total" value={String(orders.filter(o => o.status === "executed").length)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} accent="green" />
          <Tile label="Educators followed" value={String(copyingCount)} icon={<Copy className="h-3.5 w-3.5" />} accent="yellow" />
          <Tile label="Following" value={String(mentors.filter(m => m.is_following).length)} icon={<Users className="h-3.5 w-3.5" />} />
        </div>

        {/* Performance snapshot of copied trades */}
        <div className="mb-6">
          <CopiedTradesPerformance />
        </div>

        <div className="mb-4 flex items-center gap-1 rounded-xl border border-white/10 bg-[#0F0F0F] p-1 w-fit">
          {([
            { k: "trades", label: "Idea Activity" },
            { k: "mentors", label: "Followed Educators" },
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
              title="No reviewed ideas yet"
              body="Review educational market ideas from the Community Hub or Ideas page to get started."
              cta={{ to: "/community", label: "Open Community Hub" }}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0F0F0F] overflow-hidden">
              <ul className="divide-y divide-white/5">
                {orders.map((o) => {
                  const isBuy = o.side === "buy";
                  const badge = statusPill(o.status);
                  return (
                    <li key={o.id}>
                      <button
                        onClick={() => setOpenTrade(o)}
                        className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors"
                      >
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <MentorTierProgression />

            {mentors.length === 0 ? (
              <EmptyState
                title="No mentors yet"
                body="Follow educators from the Leaderboard to manage them here."
                cta={{ to: "/leaderboard", label: "Open Leaderboard" }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mentors.map((m) => (
                  <MentorCard
                    key={m.user_id}
                    m={m}
                    onToggleFollow={() => toggleFollow(m)}
                    onTogglePause={m.copy_status ? () => togglePauseMentor(m) : undefined}
                    onStop={m.copy_status ? () => stopCopyMentor(m) : undefined}
                    onStartCopy={!m.copy_status ? () => startCopyMentor(m) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------- Trade details drawer ----------------- */}
      <Sheet open={!!openTrade} onOpenChange={(v) => !v && setOpenTrade(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#0A0A0A] border-white/10 text-white overflow-y-auto">
          {openTrade && (() => {
            const isBuy = openTrade.side === "buy";
            const badge = statusPill(openTrade.status);
            const entry = openTradePosition?.open_price ?? openTrade.entry_price;
            const current = openTradePosition?.current_price ?? null;
            const sl = openTradePosition?.stop_loss ?? openTrade.stop_loss;
            const tp = openTradePosition?.take_profit ?? openTrade.take_profit;
            const profit = openTradePosition?.profit ?? null;
            const commission = openTradePosition?.commission ?? 0;
            const swap = openTradePosition?.swap ?? 0;
            const netPnl = profit != null ? Number(profit) + Number(commission || 0) + Number(swap || 0) : null;
            return (
              <>
                <SheetHeader className="text-left">
                  <SheetTitle className="font-heading text-lg uppercase flex items-center gap-2 text-white">
                    {isBuy ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                    {openTrade.symbol}
                    <span className={`ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-bold ${badge.cls}`}>
                      {badge.icon}{badge.label}
                    </span>
                  </SheetTitle>
                  <SheetDescription className="font-mono text-[10px] text-white/40">
                    Reviewed idea · {new Date(openTrade.created_at).toLocaleString()}
                    {openTrade.ea_ticket && openTrade.ea_ticket !== "0" && <> · #{openTrade.ea_ticket}</>}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-5 space-y-4">
                  {/* Entry / Exit / SL / TP */}
                  <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                      <Target className="h-3 w-3" /> Levels
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                      <Field label="Side" value={<span className={isBuy ? "text-emerald-400" : "text-red-400"}>{openTrade.side.toUpperCase()}</span>} />
                      <Field label="Volume" value={`${openTrade.volume.toFixed(2)} lots`} />
                      <Field label="Entry" value={fmt(entry)} />
                      <Field label="Current" value={current != null ? fmt(current) : "—"} />
                      <Field label="Stop Loss" value={<span className="text-red-400">{fmt(sl)}</span>} />
                      <Field label="Take Profit" value={<span className="text-emerald-400">{fmt(tp)}</span>} />
                    </div>
                  </div>

                  {/* Original mentor signal comparison */}
                  {openSignal && (
                    <div className="rounded-xl border border-[#FFCD05]/25 bg-[#FFCD05]/[0.04] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-[#FFCD05] mb-2 flex items-center gap-1.5">
                        <Copy className="h-3 w-3" /> vs Original idea · {openSignal.mentor_name}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums">
                        <div>
                          <p className="text-[9px] uppercase text-white/40">Entry</p>
                          <p className="text-white">{fmt(openSignal.entry_price)}</p>
                          {entry != null && (
                            <p className={`text-[9px] mt-0.5 ${
                              Math.abs(Number(entry) - openSignal.entry_price) < 0.0001 * Math.max(1, openSignal.entry_price)
                                ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              Δ {(Number(entry) - openSignal.entry_price).toFixed(5)}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-white/40">SL</p>
                          <p className="text-red-400/90">{fmt(openSignal.stop_loss)}</p>
                          {sl != null && openSignal.stop_loss != null && (
                            <p className="text-[9px] text-white/40 mt-0.5">
                              yours {fmt(sl)}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-white/40">TP</p>
                          <p className="text-emerald-400/90">{fmt(openSignal.take_profit)}</p>
                          {tp != null && openSignal.take_profit != null && (
                            <p className="text-[9px] text-white/40 mt-0.5">
                              yours {fmt(tp)}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-white/40">
                        Idea status:{" "}
                        <span className={openSignal.status === "active" ? "text-emerald-400" : "text-white/60"}>
                          {openSignal.status.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                      <Zap className="h-3 w-3" /> P&L breakdown
                    </p>
                    {profit == null ? (
                      <p className="text-[11px] text-white/50">
                        {openTrade.status === "executed"
                          ? "Position closed or no live P&L available."
                          : "P&L will appear once the order fills on MT5."}
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                        <Field label="Gross" value={<span className={Number(profit) >= 0 ? "text-emerald-400" : "text-red-400"}>{money(profit)}</span>} />
                        <Field label="Commission" value={money(commission)} />
                        <Field label="Swap" value={money(swap)} />
                        <div className="col-span-3 mt-1 flex items-center justify-between border-t border-white/10 pt-2">
                          <span className="text-[10px] uppercase tracking-wider text-white/40">Net</span>
                          <span className={`text-sm font-bold ${Number(netPnl) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money(netPnl)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Execution status breakdown */}
                  <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                      <Shield className="h-3 w-3" /> Execution log
                    </p>
                    {openTradeLoading ? (
                      <div className="flex items-center gap-2 text-[11px] text-white/40 py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
                    ) : openTradeLogs.length === 0 ? (
                      <p className="text-[11px] text-white/50">No execution log entries yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {openTradeLogs.map((l) => {
                          const ok = l.status === "executed" || l.classification === "filled" || l.classification === "placed";
                          return (
                            <li key={l.id} className="flex items-start gap-2 text-[11px] font-mono">
                              {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                                  : <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={ok ? "text-emerald-400" : "text-red-400"}>
                                    {(l.classification || l.status).toUpperCase()}
                                  </span>
                                  <span className="text-white/40 text-[9px]">
                                    {new Date(l.created_at).toLocaleTimeString()}
                                  </span>
                                </div>
                                {(l.retcode_description || l.error_message) && (
                                  <p className="text-white/50 leading-snug mt-0.5">
                                    {l.retcode_description || l.error_message}
                                  </p>
                                )}
                                {l.ticket && <p className="text-[#FFCD05] text-[10px] mt-0.5">#{l.ticket}</p>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {openTrade.status === "failed" && openTrade.ea_message && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1">EA message</p>
                      <p className="text-[11px] font-mono text-red-300/90 leading-snug">{openTrade.ea_message}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
    <span className="text-white">{value}</span>
  </div>
);

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

const MentorCard = ({ m, onToggleFollow, onTogglePause, onStop, onStartCopy }:
  { m: MentorRow; onToggleFollow: () => void; onTogglePause?: () => void; onStop?: () => void; onStartCopy?: () => void }) => {
  const paused = m.copy_status === "paused";
  return (
    <div className="rounded-xl border border-white/10 bg-[#0F0F0F] p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center overflow-hidden">
          {m.avatar_url
            ? <img src={m.avatar_url} alt={m.display_name} className="h-full w-full object-cover" />
            : <span className="text-[11px] font-bold text-white">{initials(m.display_name)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{m.display_name}</p>
            {m.is_mentor && (
              <span className="rounded-md bg-[#FFCD05]/15 border border-[#FFCD05]/30 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#FFCD05] font-bold">
                Educator
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {m.copy_status === "active" && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> Following
              </span>
            )}
            {paused && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                <PauseCircle className="h-2.5 w-2.5" /> Paused
              </span>
            )}
            {m.is_following && (
              <span className="text-[9px] uppercase tracking-wider text-white/40">Following</span>
            )}
            {m.risk_multiplier && m.copy_status && (
              <span className="text-[9px] font-mono text-white/40">· {m.risk_multiplier}x risk</span>
            )}
          </div>
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/50 hover:text-white shrink-0">
          <Link to={`/u/${m.user_id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={onToggleFollow}
          className={`h-7 px-2 text-[10px] gap-1 ${
            m.is_following
              ? "border-white/15 bg-transparent text-white hover:bg-white/5"
              : "border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[#FFCD05] hover:bg-[#FFCD05]/20"
          }`}>
          {m.is_following ? <><UserMinus className="h-3 w-3" /> Unfollow</> : <><Users className="h-3 w-3" /> Follow</>}
        </Button>

        {onStartCopy && (
          <Button size="sm" onClick={onStartCopy}
            className="h-7 px-2 text-[10px] gap-1 bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90 font-bold">
            <Copy className="h-3 w-3" /> Follow Educator
          </Button>
        )}
        {onTogglePause && (
          <Button size="sm" variant="outline" onClick={onTogglePause}
            className="h-7 px-2 text-[10px] border-white/15 bg-transparent text-white hover:bg-white/5 gap-1">
            {paused ? <><PlayCircle className="h-3 w-3" /> Resume</> : <><PauseCircle className="h-3 w-3" /> Pause</>}
          </Button>
        )}
        {onStop && (
          <Button size="sm" variant="outline" onClick={onStop}
            className="h-7 px-2 text-[10px] border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 gap-1">
            <XCircle className="h-3 w-3" /> Stop following
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

export default CopyTrading;
