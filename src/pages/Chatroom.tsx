import { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, Hash, Search, Users, Pin, AtSign, ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ChatMessage from "@/components/chatroom/ChatMessage";
import ChatMessageInput from "@/components/chatroom/ChatMessageInput";

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

const formatChannelName = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const getDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};

const Chatroom = () => {
  const { user, profile, signOut } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeChannelName, setActiveChannelName] = useState("trades_room");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleMap>({});
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; displayName: string; content: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load channels + roles
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("channels").select("*").order("created_at");
      if (data) {
        setChannels(data);
        const first = data.find((c) => c.name === "trades_room") || data[0];
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

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Scroll detection
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

  const handleReply = (messageId: string, displayName: string, content: string) => {
    setReplyTo({ id: messageId, displayName, content });
  };

  // Build message list with date separators and grouping info
  const buildMessageList = () => {
    const items: { type: "date"; label: string; key: string }[] | { type: "msg"; msg: Message; isGrouped: boolean; replyTo: { displayName: string; content: string } | null; key: string }[] = [];
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

      // Find reply-to message
      let replyData = null;
      if (msg.reply_to_id) {
        const parent = messages.find((m) => m.id === msg.reply_to_id);
        if (parent) {
          replyData = {
            displayName: (parent.profiles as any)?.display_name ?? "Unknown",
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
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Link to="/" className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[hsl(45,100%,50%)]" />
          <span className="font-heading text-sm font-bold text-foreground">
            Elite <span className="text-[hsl(45,100%,50%)]">Live Trading Room</span>
          </span>
        </Link>
        <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><Search className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><Users className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><AtSign className="h-4 w-4" /></Button>
      </div>
      <ScrollArea className="flex-1 px-2 py-2">
        {Object.entries(groupedChannels).map(([category, chs]) => (
          <div key={category} className="mb-3">
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{category}</p>
            {chs.map((ch) => (
              <button
                key={ch.id}
                onClick={() => { setActiveChannelId(ch.id); setActiveChannelName(ch.name); setSidebarOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-[hsl(45,100%,50%)]/10 text-[hsl(45,100%,50%)]"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Hash className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatChannelName(ch.name)}</span>
              </button>
            ))}
          </div>
        ))}
      </ScrollArea>
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${getColor(user?.id ?? "")} text-xs font-bold text-white`}>
            {getInitial(profile?.display_name ?? "U")}
          </div>
          <span className="truncate text-xs font-medium text-foreground">{profile?.display_name ?? "User"}</span>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs">Dashboard</Button>
          </Link>
          <Button variant="outline" size="sm" className="text-xs" onClick={signOut}>Logout</Button>
        </div>
      </div>
    </>
  );

  const messageItems = buildMessageList();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 flex w-72 flex-col bg-card shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <button className="md:hidden text-muted-foreground mr-1" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-heading text-base font-semibold text-foreground">{formatChannelName(activeChannelName)}</h2>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Pin className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Users className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Search className="h-4 w-4" /></Button>
          </div>
        </header>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4 bg-white">
          <div className="space-y-0">
            {messages.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">No messages yet. Be the first to say something!</p>
            )}
            {messageItems.map((item: any) => {
              if (item.type === "date") {
                return (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    <div className="flex-1 border-t border-gray-200" />
                    <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">{item.label}</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                );
              }
              const { msg, isGrouped, replyTo: rt } = item;
              return (
                <ChatMessage
                  key={msg.id}
                  id={msg.id}
                  displayName={(msg.profiles as any)?.display_name ?? "Unknown"}
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

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-gray-800 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-700 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              New messages
            </button>
          )}
        </div>

        <ChatMessageInput
          channelName={formatChannelName(activeChannelName)}
          channelId={activeChannelId}
          userId={user?.id}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSent={() => setReplyTo(null)}
        />
      </div>
    </div>
  );
};

export default Chatroom;
