import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  channelName?: string;
  selfDisplayName?: string | null;
}

/**
 * Real typing indicator backed by Supabase Realtime presence on a per-channel
 * `chat-typing:<channel>` broadcast channel. Renders empty space until a
 * remote user actually broadcasts a typing event.
 */
const TypingIndicator = ({ channelName, selfDisplayName }: Props) => {
  const [typers, setTypers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!channelName) return;
    const ch = supabase.channel(`chat-typing:${channelName}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, (payload: any) => {
      const name = String(payload?.payload?.name ?? "").trim();
      if (!name || name === selfDisplayName) return;
      setTypers((prev) => ({ ...prev, [name]: Date.now() }));
    }).subscribe();

    const sweep = window.setInterval(() => {
      setTypers((prev) => {
        const cutoff = Date.now() - 4_000;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) if (v > cutoff) next[k] = v;
        return next;
      });
    }, 1_500);

    return () => {
      window.clearInterval(sweep);
      supabase.removeChannel(ch);
    };
  }, [channelName, selfDisplayName]);

  const names = Object.keys(typers);
  if (names.length === 0) return <div className="h-5" />;

  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.length} traders are typing`;

  return (
    <div className="flex h-5 items-center gap-2 text-[11px] text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
      </span>
      <span className="italic">{text}…</span>
    </div>
  );
};

export default TypingIndicator;
