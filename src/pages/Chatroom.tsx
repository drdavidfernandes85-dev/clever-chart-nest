import { useState, useEffect, useRef } from "react";
import { TrendingUp, Hash, Send, Smile, Mic, Plus, Bold, Italic, Code, Link as LinkIcon, Search, Users, Pin, AtSign, Image, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

const Chatroom = () => {
  const { user, profile, signOut } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeChannelName, setActiveChannelName] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load channels
  useEffect(() => {
    const loadChannels = async () => {
      const { data } = await supabase.from("channels").select("*").order("created_at");
      if (data) {
        setChannels(data);
        const general = data.find((c) => c.name === "general");
        if (general) {
          setActiveChannelId(general.id);
          setActiveChannelName(general.name);
        } else if (data.length > 0) {
          setActiveChannelId(data[0].id);
          setActiveChannelName(data[0].name);
        }
      }
    };
    loadChannels();
  }, []);

  // Load messages + subscribe to realtime
  useEffect(() => {
    if (!activeChannelId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles!messages_user_id_profiles_fkey(display_name, avatar_url)")
        .eq("channel_id", activeChannelId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as unknown as Message[]);
    };
    loadMessages();

    const channel = supabase
      .channel(`messages:${activeChannelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannelId}` },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", payload.new.user_id)
            .single();
          const newMsg = { ...payload.new, profiles: profile } as unknown as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannelId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !activeChannelId || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      content: message.trim(),
      channel_id: activeChannelId,
      user_id: user.id,
    });
    if (error) {
      toast.error("Failed to send message");
    } else {
      setMessage("");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedChannels = channels.reduce<Record<string, Channel[]>>((acc, ch) => {
    (acc[ch.category] ??= []).push(ch);
    return acc;
  }, {});

  const getInitial = (name: string) => name.charAt(0).toUpperCase();
  const getColor = (userId: string) => {
    const colors = ["bg-teal-600", "bg-blue-600", "bg-indigo-600", "bg-purple-600", "bg-orange-600", "bg-pink-600", "bg-cyan-600"];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[hsl(45,100%,50%)]" />
            <span className="font-heading text-sm font-bold text-foreground">
              Elite <span className="text-[hsl(45,100%,50%)]">Live Trading Room</span>
            </span>
          </Link>
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
                  onClick={() => { setActiveChannelId(ch.id); setActiveChannelName(ch.name); }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    activeChannelId === ch.id
                      ? "bg-[hsl(45,100%,50%)]/10 text-[hsl(45,100%,50%)]"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          ))}
        </ScrollArea>

        {/* User info + logout */}
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${getColor(user?.id ?? "")} text-xs font-bold text-white`}>
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
      </aside>

      {/* Main Chat */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-heading text-base font-semibold text-foreground">{activeChannelName}</h2>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Pin className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Users className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Search className="h-4 w-4" /></Button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Be the first to say something!</p>
            )}
            {messages.map((msg) => {
              const displayName = (msg.profiles as any)?.display_name ?? "Unknown";
              return (
                <div key={msg.id} className="group flex gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/20">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${getColor(msg.user_id)} text-sm font-bold text-white`}>
                    {getInitial(displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{displayName}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/90">{msg.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Message Input */}
        <div className="border-t border-border px-4 py-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-1 border-b border-border/50 px-3 py-1.5">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Bold className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Italic className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Code className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><LinkIcon className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <Smile className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${activeChannelName}`}
                className="flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <Paperclip className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[hsl(45,100%,50%)]"
                onClick={handleSend}
                disabled={sending || !message.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatroom;
