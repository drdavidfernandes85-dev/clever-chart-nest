import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Real online-member count driven by Supabase Realtime presence on the
 * shared `community:online` channel. Every authenticated session tracks
 * itself; the returned count is the live presence size.
 *
 * Returns null until the first presence sync. Never fabricates a number.
 */
export function useOnlineCount(): number | null {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const ch = supabase.channel("community:online", {
      config: { presence: { key: user?.id ?? `anon-${Math.random().toString(36).slice(2)}` } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setCount(Object.keys(state).length);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ at: Date.now() });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return count;
}
