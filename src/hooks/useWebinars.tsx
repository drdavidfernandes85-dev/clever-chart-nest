import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Webinar {
  id: string;
  title: string;
  topic: string | null;
  host_name: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  stream_url: string | null;
  recording_url: string | null;
  thumbnail_url: string | null;
  category: string;
  status: "scheduled" | "live" | "ended" | "canceled";
  performance_impact: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Returns:
 *  - upcoming: next session that is scheduled and starts in the future (or any session marked live)
 *  - liveNow:  the session whose status === 'live'
 *  - past:     ended sessions, newest first (with optional recording)
 *  - all:      raw list
 *
 * Auto-subscribes to realtime so LIVE state and new sessions appear instantly.
 */
export const useWebinars = (enabled = true) => {
  const [items, setItems] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("webinars" as any)
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(200);
      if (mounted && data) setItems(data as unknown as Webinar[]);
      if (mounted) setLoading(false);
    };
    load();

    const channel = supabase.channel(
      `webinars-feed-${Math.random().toString(36).slice(2)}`,
    );
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "webinars" },
      () => load(),
    );
    channel.subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  const { liveNow, upcoming, past } = useMemo(() => {
    const now = Date.now();
    const live = items.find((w) => w.status === "live") ?? null;
    const future = items
      .filter(
        (w) =>
          (w.status === "scheduled" || w.status === "live") &&
          new Date(w.scheduled_at).getTime() > now - 5 * 60 * 1000, // include just-started
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      );
    const next = live ?? future[0] ?? null;
    const recordings = items
      .filter((w) => w.status === "ended" || !!w.recording_url)
      .sort(
        (a, b) =>
          new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
      );
    return { liveNow: live, upcoming: next, past: recordings };
  }, [items]);

  return { items, liveNow, upcoming, past, loading };
};

/**
 * Compact countdown helper.
 * Returns label like "47m", "2h 14m", "3d", "starting…", "LIVE NOW".
 */
export const useCountdown = (targetIso: string | null | undefined) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return { label: "", diffMs: 0 };
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return { label: "starting…", diffMs: diff };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { label: `${mins}m`, diffMs: diff };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { label: `${hrs}h ${mins % 60}m`, diffMs: diff };
  const days = Math.floor(hrs / 24);
  return { label: `${days}d ${hrs % 24}h`, diffMs: diff };
};
