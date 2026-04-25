import { useEffect, useState } from "react";
import { Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "🚀", "💯", "👀"];

interface ReactionRow {
  emoji: string;
  user_id: string;
}

interface MessageReactionsProps {
  messageId: string;
}

const MessageReactions = ({ messageId }: MessageReactionsProps) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("message_reactions" as any)
      .select("emoji, user_id")
      .eq("message_id", messageId);
    setReactions((data ?? []) as unknown as ReactionRow[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions", filter: `message_id=eq.${messageId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  const toggle = async (emoji: string) => {
    if (!user) return;
    const mine = reactions.find((r) => r.emoji === emoji && r.user_id === user.id);
    if (mine) {
      await supabase
        .from("message_reactions" as any)
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      await supabase
        .from("message_reactions" as any)
        .insert({ message_id: messageId, user_id: user.id, emoji });
    }
    setPickerOpen(false);
  };

  // Group by emoji
  const grouped = reactions.reduce<Record<string, ReactionRow[]>>((acc, r) => {
    (acc[r.emoji] ||= []).push(r);
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0 && !pickerOpen) {
    return (
      <button
        onClick={() => setPickerOpen(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        title="Add reaction"
      >
        <Smile className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {Object.entries(grouped).map(([emoji, rows]) => {
        const mine = rows.some((r) => r.user_id === user?.id);
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            className={`flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs transition-colors ${
              mine
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-border/40 bg-secondary/40 text-muted-foreground hover:bg-secondary"
            }`}
          >
            <span>{emoji}</span>
            <span className="font-semibold">{rows.length}</span>
          </button>
        );
      })}
      {pickerOpen ? (
        <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-card px-1 py-0.5">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => toggle(e)}
              className="rounded p-0.5 text-sm hover:bg-secondary"
            >
              {e}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-md border border-border/40 bg-secondary/40 p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Add reaction"
        >
          <Smile className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default MessageReactions;
