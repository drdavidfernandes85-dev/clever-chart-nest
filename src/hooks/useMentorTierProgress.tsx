import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { computeMentorTier, MentorTier, MentorTierId, MENTOR_TIERS } from "@/lib/mentor-tier";

const TIER_ORDER: MentorTierId[] = [
  "rising_star",
  "verified_trader",
  "mentor",
  "elite_mentor",
];

const storageKey = (uid: string) => `mentor_tier_seen:${uid}`;

interface State {
  currentTier: MentorTier | null;
  /** A tier the user just unlocked and hasn't acknowledged yet. */
  newlyUnlocked: MentorTier | null;
  acknowledge: () => void;
}

/**
 * Detects when the signed-in user crosses a new Mentor Verification tier
 * threshold and surfaces a one-time celebration trigger.
 * Persistence is per-user in localStorage so we don't celebrate twice.
 */
export const useMentorTierProgress = (): State => {
  const { user } = useAuth();
  const [currentTier, setCurrentTier] = useState<MentorTier | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<MentorTier | null>(null);

  useEffect(() => {
    if (!user) {
      setCurrentTier(null);
      setNewlyUnlocked(null);
      return;
    }
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("leaderboard_stats")
        .select("total_trades, win_rate, total_pnl, pnl_30d")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const tier = computeMentorTier({
        totalTrades: data?.total_trades ?? 0,
        winRate: data?.win_rate ?? 0,
        totalPnl: data?.total_pnl ?? 0,
        pnl30d: data?.pnl_30d ?? 0,
      });
      setCurrentTier(tier);

      if (!tier) return;

      const seenRaw = window.localStorage.getItem(storageKey(user.id));
      const seenIdx = seenRaw ? TIER_ORDER.indexOf(seenRaw as MentorTierId) : -1;
      const currentIdx = TIER_ORDER.indexOf(tier.id);

      if (currentIdx > seenIdx) {
        setNewlyUnlocked(tier);
        // Best-effort in-app bell notification
        try {
          await supabase.from("notifications").insert({
            user_id: user.id,
            kind: "tier_up",
            title: `🎉 ${tier.label} unlocked!`,
            body: `Congratulations! You've reached ${tier.label} status.`,
            link: "/profile",
          });
        } catch {
          /* RLS may block insert in some setups; non-fatal */
        }
      }
    };
    check();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const acknowledge = () => {
    if (user && newlyUnlocked) {
      window.localStorage.setItem(storageKey(user.id), newlyUnlocked.id);
    }
    setNewlyUnlocked(null);
  };

  return { currentTier, newlyUnlocked, acknowledge };
};

/** Test helper: clear stored tier acknowledgement. */
export const _resetTierProgress = (uid: string) =>
  window.localStorage.removeItem(storageKey(uid));

export { MENTOR_TIERS };