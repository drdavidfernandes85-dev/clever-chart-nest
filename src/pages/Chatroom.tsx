import { useState, useEffect, useRef, useCallback } from "react";
import { Hash, Search, Users, Pin, AtSign, ChevronDown, Menu, X, Maximize2, Minimize2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ChatMessage from "@/components/chatroom/ChatMessage";
import ChatMessageInput from "@/components/chatroom/ChatMessageInput";

import SampleMessages from "@/components/chatroom/SampleMessages";
import TypingIndicator from "@/components/chatroom/TypingIndicator";
import CommunityHubRail from "@/components/chatroom/CommunityHubRail";
import WelcomeBanner from "@/components/chatroom/WelcomeBanner";
import CommunityTrustBar from "@/components/social/CommunityTrustBar";
import AICopilot from "@/components/ai/AICopilot";
import { useLanguage } from "@/i18n/LanguageContext";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import SEO from "@/components/SEO";

interface Channel {
  id: string;
  name: string;
  category: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  reply_to_id?: string | null;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

type UserRoleMap = Record<string, string>;

const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  general: "General",
  espanol: "ES",
  portugues_brasil: "PT",
  trades_room: "Trades Room",
  news_and_research: "News And Research",
  indices: "Indices",
  crypto: "Crypto",
  commodities: "Commodities",
  webinar_chat: "Webinar Chat",
};

const formatChannelName = (name: string) =>
  CHANNEL_DISPLAY_NAMES[name] ??
  name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Explicit ordering of sidebar sections and the channels inside each section.
const CATEGORY_ORDER = ["Trading", "Research", "Markets", "Live"] as const;
const CHANNEL_ORDER: Record<string, string[]> = {
  Trading: ["general", "espanol", "portugues_brasil", "trades_room"],
  Research: ["news_and_research"],
  Markets: ["indices", "crypto", "commodities"],
  Live: ["webinar_chat"],
};

// Channels that represent a localized room — shown with a small flag chip.
const CHANNEL_FLAGS: Record<string, string> = {
  espanol: "🇪🇸",
  portugues_brasil: "🇧🇷",
};

const useDateLabel = () => {
  const { t } = useLanguage();
  return (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (today.getTime() - msgDay.getTime()) / 86400000;
    if (diff === 0) return t("chat.today");
    if (diff === 1) return t("chat.yesterday");
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };
};

const FOCUS_KEY = "infinox.chatroom.focus";
const COPILOT_COLLAPSED_KEY = "infinox.chatroom.copilotCollapsed";

const Chatroom = () => {
  const { user, profile, signOut } = useAuth();
  const { t } = useLanguage();
  const getDateLabel = useDateLabel();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeChannelName, setActiveChannelName] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleMap>({});
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; displayName: string; content: string } | null>(null);
  const [allProfiles, setAllProfiles] = useState<{ user_id: string; display_name: string }[]>([]);
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(FOCUS_KEY) === "1";
  });
  const [copilotCollapsed, setCopilotCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COPILOT_COLLAPSED_KEY) === "1";
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(FOCUS_KEY, focusMode ? "1" : "0");
  }, [focusMode]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(COPILOT_COLLAPSED_KEY, copilotCollapsed ? "1" : "0");
  }, [copilotCollapsed]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("channels").select("*").order("created_at");
      if (data) {
        setChannels(data);
        const first =
          data.find((c) => c.name === "general") ||
          data.find((c) => c.name === "trades_room") ||
          data[0];
        if (first) { setActiveChannelId(first.id); setActiveChannelName(first.name); }
      }
    };
    load();
    const loadRoles = async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      if (data) {
        const map: UserRoleMap = {};
        data.forEach((r) => { if (r.role === "admin" || r.role === "moderator") map[r.user_id] = r.role; });
        setUserRoles(map);
      }
    };
    loadRoles();
    const loadProfiles = async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      if (data) setAllProfiles(data);
    };
    loadProfiles();
  }, []);

  const loadMessages = useCallback(async () => {
    if (!activeChannelId) return;
    const { data } = await supabase
      .from("messages")
      .select("*, profiles!messages_user_id_profiles_fkey(display_name, avatar_url)")
      .eq("channel_id", activeChannelId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) setMessages(data as unknown as Message[]);
  }, [activeChannelId]);

  useEffect(() => {
    loadMessages();
    if (!activeChannelId) return;
    const channel = supabase
      .channel(`messages:${activeChannelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannelId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data: prof } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", (payload.new as any).user_id).single();
            setMessages((prev) => [...prev, { ...payload.new, profiles: prof } as unknown as Message]);
          } else {
            loadMessages();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  const getColor = (userId: string) => {
    const colors = ["bg-teal-600", "bg-blue-600", "bg-indigo-600", "bg-purple-600", "bg-orange-600", "bg-pink-600", "bg-cyan-600"];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const groupedChannels = channels.reduce<Record<string, Channel[]>>((acc, ch) => {
    (acc[ch.category] ??= []).push(ch);
    return acc;
  }, {});

  // Build the ordered sidebar sections — categories and channels follow the
  // explicit order defined at the top of this file, with any unknown extras
  // appended at the end so we never silently drop a channel from the DB.
  const orderedSections = (() => {
    const used = new Set<string>();
    const sections: { category: string; channels: Channel[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const list = groupedChannels[cat];
      if (!list?.length) continue;
      const order = CHANNEL_ORDER[cat] ?? [];
      const sorted = [...list].sort((a, b) => {
        const ai = order.indexOf(a.name);
        const bi = order.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      sorted.forEach((c) => used.add(c.id));
      sections.push({ category: cat, channels: sorted });
    }
    // Fallback bucket for any uncategorized channels
    Object.entries(groupedChannels).forEach(([cat, list]) => {
      const remaining = list.filter((c) => !used.has(c.id));
      if (remaining.length) sections.push({ category: cat, channels: remaining });
    });
    return sections;
  })();

  const handleReply = (messageId: string, displayName: string, content: string) => {
    setReplyTo({ id: messageId, displayName, content });
  };

  const buildMessageList = () => {
    const result: any[] = [];
    let lastDate = "";
    let lastUserId = "";
    let lastTime = 0;

    messages.forEach((msg) => {
      const dateLabel = getDateLabel(msg.created_at);
      if (dateLabel !== lastDate) {
        result.push({ type: "date", label: dateLabel, key: `date-${msg.created_at}` });
        lastDate = dateLabel;
        lastUserId = "";
      }

      const msgTime = new Date(msg.created_at).getTime();
      const isGrouped = msg.user_id === lastUserId && (msgTime - lastTime) < 5 * 60 * 1000;

      let replyData = null;
      if (msg.reply_to_id) {
        const parent = messages.find((m) => m.id === msg.reply_to_id);
        if (parent) {
          replyData = {
            displayName: (parent.profiles as any)?.display_name ?? t("chat.unknown"),
            content: parent.content.slice(0, 100),
          };
        }
      }

      result.push({ type: "msg", msg, isGrouped, replyTo: replyData, key: msg.id });
      lastUserId = msg.user_id;
      lastTime = msgTime;
    });
    return result;
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-border/50 px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={infinoxLogo} alt="INFINOX" className="h-4" />
          <span className="hidden sm:inline text-xs text-muted-foreground/40">|</span>
          <span className="font-heading text-xs font-semibold text-foreground tracking-tight">
            <span className="text-primary">IX</span> Live Trading Room
          </span>
        </Link>
        <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-1 border-b border-border/50 px-3 py-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><Search className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><Users className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><AtSign className="h-4 w-4" /></Button>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        {orderedSections.map(({ category, channels: chs }, idx) => (
          <div key={category} className={idx > 0 ? "mt-4 pt-3 border-t border-border/40" : ""}>
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
              {category}
            </p>
            <div className="space-y-0.5">
              {chs.map((ch) => {
                const isActive = activeChannelId === ch.id;
                const flag = CHANNEL_FLAGS[ch.name];
                return (
                  <button
                    key={ch.id}
                    onClick={() => { setActiveChannelId(ch.id); setActiveChannelName(ch.name); setSidebarOpen(false); }}
                    className={`group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-all ${
                      isActive
                        ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(48_100%_51%/0.35),0_4px_18px_-6px_hsl(48_100%_51%/0.5)]"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />
                    <span className="truncate font-medium">{formatChannelName(ch.name)}</span>
                    {flag && (
                      <span
                        aria-hidden="true"
                        className={`ml-auto text-xs leading-none ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                      >
                        {flag}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-4 border-t border-border/40 pt-3">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
            Community
          </p>
          <Link
            to="/community/guidelines"
            onClick={() => setSidebarOpen(false)}
            className="group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-all hover:bg-secondary/50 hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/80" />
            <span className="truncate font-medium">Community Guidelines</span>
          </Link>
        </div>
      </ScrollArea>
      <div className="border-t border-border/50 p-3 space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${getColor(user?.id ?? "")} text-xs font-bold text-foreground`}>
            {getInitial(profile?.display_name ?? "U")}
          </div>
          <span className="truncate text-xs font-medium text-foreground">{profile?.display_name ?? t("chat.user")}</span>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs rounded-xl">{t("chat.dashboard")}</Button>
          </Link>
          <Button variant="outline" size="sm" className="text-xs rounded-xl" onClick={signOut}>{t("chat.logout")}</Button>
        </div>
      </div>
    </>
  );

  const messageItems = buildMessageList();

  return (
    <>
    <SEO
      title={t("chat.seo.title")}
      description={t("chat.seo.desc")}
      keywords={t("chat.seo.keywords")}
      canonical="https://elitelivetradingroom.com/chatroom"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: t("chat.seo.title"),
        description: t("chat.seo.desc"),
        url: "https://elitelivetradingroom.com/chatroom",
      }}
    />
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border/50 bg-card md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 flex w-72 flex-col bg-card shadow-2xl shadow-background/50">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex flex-1 min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border/50 px-4 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button className="md:hidden text-muted-foreground mr-1" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-heading text-base font-semibold text-foreground tracking-tight">{formatChannelName(activeChannelName)}</h2>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Pin className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Users className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Search className="h-4 w-4" /></Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 gap-1.5 text-xs ${focusMode ? "text-primary" : ""}`}
              onClick={() => setFocusMode((v) => !v)}
              aria-pressed={focusMode}
              title={focusMode ? t("chat.exitFocusMode") : t("chat.enterFocusMode")}
            >
              {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{focusMode ? t("chat.exitFocus") : t("chat.focus")}</span>
            </Button>
          </div>
        </header>

        {/* Community trust bar — social proof + tagline (regulation compliant). */}
        {!focusMode && (
          <div className="border-b border-border/30 bg-background/60 px-3 py-2 sm:px-4">
            <CommunityTrustBar compact />
          </div>
        )}

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4 bg-background">
          <div className="space-y-0">
            {/* Auto welcome message — appears at the top of every channel, localized. */}
            <WelcomeBanner locale={useLanguage().locale} />

            {messages.length === 0 && activeChannelName === "general" && (
              <SampleMessages />
            )}
            {messages.length === 0 && activeChannelName !== "general" && (
              <p className="text-center text-sm text-muted-foreground py-12">
                {t("chat.empty")}{activeChannelName.replace(/_/g, " ")} {t("chat.emptySuffix")}
              </p>
            )}
            {messageItems.map((item: any) => {
              if (item.type === "date") {
                return (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    <div className="flex-1 border-t border-border/30" />
                    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{item.label}</span>
                    <div className="flex-1 border-t border-border/30" />
                  </div>
                );
              }
              const { msg, isGrouped, replyTo: rt } = item;
              return (
                <ChatMessage
                  key={msg.id}
                  id={msg.id}
                  displayName={(msg.profiles as any)?.display_name ?? t("chat.unknown")}
                  userId={msg.user_id}
                  content={msg.content}
                  createdAt={msg.created_at}
                  role={userRoles[msg.user_id]}
                  isGrouped={isGrouped}
                  currentUserId={user?.id}
                  replyTo={rt}
                  onReply={handleReply}
                  onMessageUpdate={loadMessages}
                />
              );
            })}
          </div>

          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl bg-card px-4 py-2 text-xs font-medium text-foreground border border-border/50 shadow-lg hover:bg-secondary transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              {t("chat.newMessages")}
            </button>
          )}
        </div>

        <div className="px-4 pt-1">
          <TypingIndicator />
        </div>

        <ChatMessageInput
          channelName={formatChannelName(activeChannelName)}
          channelId={activeChannelId}
          userId={user?.id}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSent={() => setReplyTo(null)}
          members={allProfiles}
        />
      </div>

      {/* Community Hub right rail — visible on xl+ */}
      {!focusMode && (
        <aside className="hidden xl:flex w-80 shrink-0 flex-col border-l border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex h-14 items-center gap-2 border-b border-border/50 px-4">
            <span className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              Community <span className="text-primary">Hub</span>
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <CommunityHubRail />
          </div>
        </aside>
      )}

      {/* AI Trading Assistant — floating bubble for educational Q&A. */}
      <AICopilot />
    </div>
    </>
  );
};

export default Chatroom;
