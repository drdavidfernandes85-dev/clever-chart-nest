import { useEffect, useState, useCallback } from "react";
import { Bell, Check, Trash2, TrendingUp, AtSign, MessageSquare, Calendar, Video } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Notification {
  id: string;
  kind: "signal" | "mention" | "reply" | "webinar" | "calendar";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const iconFor = (kind: Notification["kind"]) => {
  switch (kind) {
    case "signal": return <TrendingUp className="h-3.5 w-3.5 text-primary" />;
    case "mention": return <AtSign className="h-3.5 w-3.5 text-primary" />;
    case "reply": return <MessageSquare className="h-3.5 w-3.5 text-primary" />;
    case "webinar": return <Video className="h-3.5 w-3.5 text-primary" />;
    case "calendar": return <Calendar className="h-3.5 w-3.5 text-primary" />;
  }
};

const timeAgo = (iso: string) => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

const NotificationsBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setItems(data as unknown as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchItems();
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev].slice(0, 30));
          // Toast preview
          toast(n.title, { description: n.body ?? undefined, duration: 5000 });
          // Browser notification (if permission granted)
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(n.title, { body: n.body ?? "", icon: "/favicon.ico" });
            } catch {}
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchItems]);

  // Ask for permission once
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from("notifications" as any).update({ read: true } as any).eq("user_id", user.id).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications" as any).update({ read: true } as any).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notifications" as any).delete().eq("user_id", user.id);
    setItems([]);
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono text-primary">{unreadCount} new</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 px-2 text-[10px] gap-1">
                <Check className="h-3 w-3" /> Read
              </Button>
            )}
            {items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-[10px] gap-1 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          {loading && items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No notifications yet</p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                You'll be notified about new signals, mentions and webinars.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {items.map((n) => {
                const inner = (
                  <div className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${!n.read ? "bg-primary/[0.04]" : ""}`}>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      {iconFor(n.kind)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{n.title}</p>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    </div>
                    {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} to={n.link} onClick={() => markRead(n.id)} className="block">
                    {inner}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => markRead(n.id)} className="block w-full text-left">
                    {inner}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsBell;
