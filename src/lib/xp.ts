import { supabase } from "@/integrations/supabase/client";

export const XP_REWARDS = {
  trade_logged: 25,
  trade_closed: 50,
  signal_posted: 75,
  message_posted: 5,
  daily_login: 10,
  badge_earned: 100,
} as const;

export type XPSource = keyof typeof XP_REWARDS;

/** Award XP to the current user. Silently no-ops on error. */
export const awardXp = async (
  userId: string | undefined,
  source: XPSource,
  context: Record<string, unknown> = {}
) => {
  if (!userId) return;
  const amount = XP_REWARDS[source];
  try {
    await (supabase.rpc as any)("award_xp", {
      _user_id: userId,
      _amount: amount,
      _source: source,
      _context: context,
    });
  } catch (e) {
    // non-blocking
    console.warn("award_xp failed", e);
  }
};

export const xpForNextLevel = (level: number) => level * 500;
export const progressInLevel = (totalXp: number) => totalXp % 500;
