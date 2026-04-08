import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ChatMsg {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: { display_name: string } | null;
}

const getInitial = (name: string) => name.charAt(0).toUpperCase();
const getColor = (userId: string) => {
  const colors = ["bg-teal-600", "bg-blue-600", "bg-indigo-600", "bg-purple-600", "bg-orange-600", "bg-pink-600"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};
const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const WebinarChat = ({ channelName = "webinar_chat" }: { channelName?: string }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Get or create channel
  useEffect(() => {
    const init = async () => {
      let { data } = await supabase.from("channels").select("id").eq("name", channelName).maybeSingle();
      if (!data) {
        const { data: created } = await supabase
          .from("channels")
          .insert({ name: channelName, category: "Live", description: "Webinar live chat" })
          .select("id")
          .single();
        data = created;
      }
      if (data) setChannelId(data.id);
    };
    init();
  }, [channelName]);

  const fetchMessages = useCallback(async () => {
    if (!channelId) return;
    const { data } = await supabase
      .from("messages")
      .select("id, content, created_at, user_id, profiles!messages_user_id_profiles_fkey(display_name)")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) setMessages(data as unknown as ChatMsg[]);
  }, [channelId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`webinar-chat-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channelId, fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !channelId || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({ content: message.trim(), channel_id: channelId, user_id: user.id });
    if (error) toast.error("Failed to send");
    else setMessage("");
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 border-b border-border/50 bg-secondary/30 px-3 py-2">
        <MessageSquare className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Live Chat</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{messages.length} msgs</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Say something!</p>
          )}
          {messages.map((msg) => {
            const name = msg.profiles?.display_name || "User";
            return (
              <div key={msg.id} className="flex items-start gap-2 px-1 py-1 rounded-lg hover:bg-secondary/30 transition-colors">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${getColor(msg.user_id)} text-[10px] font-bold text-foreground`}>
                  {getInitial(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground">{name}</span>
                    <span className="text-[9px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                  </div>
                  <p className="text-xs text-secondary-foreground leading-relaxed break-words">{msg.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {user ? (
        <div className="border-t border-border/50 p-2">
          <div className="flex gap-1.5">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              className="h-8 text-xs border-border/50 bg-secondary/50"
            />
            <Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleSend} disabled={sending || !message.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border/50 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Log in to chat</p>
        </div>
      )}
    </div>
  );
};

export default WebinarChat;
