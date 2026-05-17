import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  MessageSquare,
  Radio,
  Send,
  Trophy,
  ArrowRight,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import SEO from "@/components/SEO";
import OnlineTraders from "@/components/chatroom/OnlineTraders";
import LiveSharedSignals from "@/components/dashboard/LiveSharedSignals";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Channel {
  id: string;
  name: string;
  category: string;
}

interface ChatMsg {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

interface LeaderRow {
  user_id: string;
  display_name: string;
  total_xp: number;
  level: number;
}

const initialsOf = (n?: string | null) =>
  (n || "TR")
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "TR";

const colorFor = (id: string) => {
  const palette = [
    "bg-teal-600/30 text-teal-200",
    "bg-blue-600/30 text-blue-200",
    "bg-indigo-600/30 text-indigo-200",
    "bg-purple-600/30 text-purple-200",
    "bg-orange-600/30 text-orange-200",
    "bg-pink-600/30 text-pink-200",
    "bg-cyan-600/30 text-cyan-200",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const Community = () => {
  const { t, locale } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load channels
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("channels")
        .select("id, name, category")
        .order("created_at");
      if (cancelled || !data) return;
      setChannels(data);
      const first =
        data.find((c) => c.name === "general") || data[0];
      if (first) setActiveChannelId(first.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load + subscribe to messages
  useEffect(() => {
    if (!activeChannelId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select(
          "id, content, created_at, user_id, channel_id, profiles!messages_user_id_profiles_fkey(display_name, avatar_url)",
        )
        .eq("channel_id", activeChannelId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(80);
      if (!cancelled && data) setMessages(data as unknown as ChatMsg[]);
    };
    load();

    const ch = supabase
      .channel(`community-msgs:${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          const row = payload.new as ChatMsg;
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", row.user_id)
            .single();
          setMessages((prev) => [...prev, { ...row, profiles: prof }]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeChannelId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Leaderboard teaser
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: xp } = await supabase
        .from("user_xp")
        .select("user_id, total_xp, level")
        .order("total_xp", { ascending: false })
        .limit(5);
      if (cancelled || !xp?.length) return;
      const ids = xp.map((x) => x.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const nameMap = new Map(
        (profs || []).map((p) => [p.user_id, p.display_name]),
      );
      setLeaders(
        xp.map((x) => ({
          user_id: x.user_id,
          display_name: nameMap.get(x.user_id) || "Trader",
          total_xp: x.total_xp,
          level: x.level,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  const handleSend = async () => {
    if (!draft.trim() || !activeChannelId || !user?.id) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      content: draft.trim(),
      channel_id: activeChannelId,
      user_id: user.id,
    });
    if (error) {
      toast.error("Failed to send");
    } else {
      setDraft("");
    }
    setSending(false);
  };

  const seoLang =
    locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";

  return (
    <main className="relative min-h-screen bg-[#050505] text-foreground">
      <SEO
        title="Community Hub | IX Sala de Trading"
        description="Professional trading community: live chat, shared signals, and top traders. Real-time collaboration with mentors and peers."
        canonical="https://ixsalatrading.com/community"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          headline: "Community Hub",
          inLanguage: seoLang,
          url: "https://ixsalatrading.com/community",
        }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#FFCD05]" />
          <h1 className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-foreground">
            Community Hub
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <MT5StatusBadge />
          <Link
            to="/dashboard"
            className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-[#FFCD05]"
          >
            ← Terminal
          </Link>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="grid h-[calc(100vh-3rem)] grid-cols-1 gap-px bg-white/5 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        {/* LEFT — Online Traders */}
        <aside className="flex flex-col bg-[#0F0F0F]">
          <div className="flex h-10 items-center gap-2 border-b border-white/5 px-4">
            <Users className="h-3.5 w-3.5 text-[#FFCD05]" />
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">
              Online Traders
            </span>
          </div>
          <ScrollArea className="flex-1 px-2 py-3">
            <OnlineTraders />
          </ScrollArea>
        </aside>

        {/* CENTER — Live Chatroom */}
        <section className="flex min-w-0 flex-col bg-[#0a0a0a]">
          {/* Channel tabs */}
          <div className="flex h-10 items-center gap-1 overflow-x-auto border-b border-white/5 px-3">
            {channels.length === 0 && (
              <span className="text-[11px] text-muted-foreground">
                Loading channels…
              </span>
            )}
            {channels.slice(0, 8).map((ch) => {
              const isActive = ch.id === activeChannelId;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? "bg-[#FFCD05]/15 text-[#FFCD05]"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Hash className="h-3 w-3" />
                  {ch.name.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <MessageSquare className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    No messages yet. Say hi to the room.
                  </p>
                </div>
              </div>
            )}
            <ul className="space-y-3">
              {messages.map((m) => {
                const name = m.profiles?.display_name || "Trader";
                return (
                  <li key={m.id} className="flex items-start gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${colorFor(
                        m.user_id,
                      )}`}
                    >
                      {initialsOf(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {name}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-sm leading-relaxed text-foreground/90">
                        {m.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Composer */}
          <div className="border-t border-white/5 bg-[#0F0F0F] p-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#050505] px-3 py-1.5 focus-within:border-[#FFCD05]/40">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  activeChannel
                    ? `Message #${activeChannel.name.replace(/_/g, " ")}`
                    : "Select a channel…"
                }
                disabled={!activeChannelId || !user}
                className="flex-1 border-0 bg-transparent p-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || !draft.trim() || !activeChannelId}
                className="h-7 gap-1 rounded-md bg-[#FFCD05] px-2.5 text-[11px] font-bold text-black hover:bg-[#FFD83A]"
              >
                <Send className="h-3 w-3" />
                Send
              </Button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-muted-foreground/70">
              Real-time chat • Be respectful • No financial advice
            </p>
          </div>
        </section>

        {/* RIGHT — Signals + Leaderboard teaser */}
        <aside className="flex min-h-0 flex-col bg-[#0F0F0F]">
          {/* Signals */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-white/5">
            <div className="flex h-10 items-center justify-between gap-2 border-b border-white/5 px-4">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 animate-pulse text-[#FFCD05]" />
                <span className="font-heading text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">
                  Live Shared Signals
                </span>
              </div>
              <Link
                to="/signals"
                className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-[#FFCD05]"
              >
                All →
              </Link>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <LiveSharedSignals />
            </div>
          </div>

          {/* Leaderboard teaser */}
          <div className="shrink-0">
            <div className="flex h-10 items-center justify-between gap-2 border-b border-white/5 px-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-[#FFCD05]" />
                <span className="font-heading text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">
                  Top Traders
                </span>
              </div>
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-[#FFCD05]"
              >
                Full board <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
            <ul className="divide-y divide-white/5">
              {leaders.length === 0 && (
                <li className="px-4 py-3 text-[11px] text-muted-foreground">
                  No ranking data yet.
                </li>
              )}
              {leaders.map((l, i) => (
                <li
                  key={l.user_id}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/5"
                >
                  <span className="w-5 text-center font-mono text-[11px] font-bold text-[#FFCD05]">
                    {i + 1}
                  </span>
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${colorFor(
                      l.user_id,
                    )}`}
                  >
                    {initialsOf(l.display_name)}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                    {l.display_name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    L{l.level}
                  </span>
                  <span className="font-mono text-[11px] font-bold tabular-nums text-foreground">
                    {l.total_xp.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default Community;
