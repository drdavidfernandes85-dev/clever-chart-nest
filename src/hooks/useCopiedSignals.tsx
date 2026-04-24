import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns the set of trading_signals.id that the current user has already
 * copied (queued via Quick Trade). Live-updates on inserts.
 */
export function useCopiedSignals() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setCopied(new Set());
      return;
    }
    let cancelled = false;
    const fetchCopied = async () => {
      const { data } = await supabase
        .from("mt_pending_orders")
        .select("signal_id")
        .eq("user_id", user.id)
        .not("signal_id", "is", null);
      if (cancelled) return;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.signal_id) set.add(r.signal_id);
      });
      setCopied(set);
    };
    fetchCopied();

    const channel = supabase
      .channel(`copied-signals-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mt_pending_orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const sig = payload?.new?.signal_id;
          if (sig) setCopied((prev) => new Set(prev).add(sig));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return copied;
}
