import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Real online-member count driven by Supabase Realtime presence on the
 * shared `community:online` channel.
 *
 * Implementation: module-level singleton with refcounted subscribers.
 * Why: `supabase.channel(name)` returns the SAME channel instance for a
 * given name. If two components both call it and then `.on()` after the
 * first one already `.subscribe()`d, supabase-js throws
 * "cannot add 'presence' callbacks ... after subscribe()". That was the
 * Sidebar + MobileDrawer crash, also triggered by StrictMode double-mount.
 *
 * The singleton creates the channel exactly once, registers `.on()` BEFORE
 * `.subscribe()`, and tears it down only when the last consumer unmounts.
 *
 * Returns null until the first presence sync. Never fabricates a number.
 */

type Listener = (n: number | null) => void;

let channel: ReturnType<typeof supabase.channel> | null = null;
let refCount = 0;
let lastCount: number | null = null;
let failed = false;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(failed ? null : lastCount);
}

function ensureChannel(userKey: string) {
  if (channel) return;
  failed = false;
  const ch = supabase.channel("community:online", {
    config: { presence: { key: userKey } },
  });
  // Register ALL handlers BEFORE subscribe(). This is the contract that
  // supabase-js enforces and the bug we hit by re-using the channel.
  ch.on("presence", { event: "sync" }, () => {
    try {
      const state = ch.presenceState();
      lastCount = Object.keys(state).length;
      notify();
    } catch { /* swallow */ }
  });
  ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      try { await ch.track({ at: Date.now() }); } catch { /* ignore */ }
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      failed = true;
      notify();
    }
  });
  channel = ch;
}

function teardownChannel() {
  if (!channel) return;
  try { supabase.removeChannel(channel); } catch { /* ignore */ }
  channel = null;
  lastCount = null;
}

export function useOnlineCount(): number | null {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(lastCount);

  useEffect(() => {
    const userKey = user?.id ?? `anon-${Math.random().toString(36).slice(2)}`;
    ensureChannel(userKey);
    refCount += 1;
    const listener: Listener = (n) => setCount(n);
    listeners.add(listener);
    // Hydrate immediately from cached value.
    setCount(failed ? null : lastCount);

    return () => {
      listeners.delete(listener);
      refCount = Math.max(0, refCount - 1);
      // Defer teardown to absorb StrictMode double-mount / fast remounts.
      if (refCount === 0) {
        const handle = setTimeout(() => {
          if (refCount === 0) teardownChannel();
        }, 250);
        // Cancel teardown if a new consumer mounts during the grace window.
        // (No-op: setTimeout will check refCount again at fire time.)
        void handle;
      }
    };
  }, [user?.id]);

  return failed ? null : count;
}
