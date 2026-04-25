import { LucideIcon, Star, ShieldCheck, Crown, Sparkles } from "lucide-react";

export type MentorTierId =
  | "rising_star"
  | "verified_trader"
  | "mentor"
  | "elite_mentor";

export interface MentorTier {
  id: MentorTierId;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon/label accent. */
  text: string;
  /** Tailwind background tint class for chip background. */
  bg: string;
  /** Tailwind ring color class for chip outline. */
  ring: string;
  /** Soft glow color (HSL string for box-shadow). */
  glow: string;
}

export interface AuthorStats {
  totalTrades?: number | null;
  winRate?: number | null; // 0..100
  totalPnl?: number | null;
  pnl30d?: number | null;
}

export const MENTOR_TIERS: Record<MentorTierId, MentorTier> = {
  rising_star: {
    id: "rising_star",
    label: "Rising Star",
    short: "Rising Star",
    icon: Star,
    text: "text-slate-200",
    bg: "bg-slate-400/15",
    ring: "ring-slate-300/40",
    glow: "0 0 18px -4px hsl(210 20% 80% / 0.45)",
  },
  verified_trader: {
    id: "verified_trader",
    label: "Verified Trader",
    short: "Verified",
    icon: ShieldCheck,
    text: "text-sky-300",
    bg: "bg-sky-500/15",
    ring: "ring-sky-400/45",
    glow: "0 0 22px -4px hsl(200 90% 60% / 0.55)",
  },
  mentor: {
    id: "mentor",
    label: "Mentor",
    short: "Mentor",
    icon: Crown,
    text: "text-primary",
    bg: "bg-primary/15",
    ring: "ring-primary/45",
    glow: "0 0 26px -4px hsl(48 100% 51% / 0.7)",
  },
  elite_mentor: {
    id: "elite_mentor",
    label: "Elite Mentor",
    short: "Elite",
    icon: Sparkles,
    text: "text-fuchsia-300",
    bg: "bg-fuchsia-500/15",
    ring: "ring-fuchsia-400/45",
    glow: "0 0 28px -4px hsl(290 90% 65% / 0.65)",
  },
};

/**
 * Compute the highest mentor tier a trader qualifies for.
 * Returns null when the trader hasn't reached any tier yet.
 *
 * Tiers (ascending):
 *  - Rising Star: 20+ closed trades, win rate > 50%
 *  - Verified Trader: 50+ closed trades, win rate > 58%
 *  - Mentor: 120+ trades, win rate > 63%, 2+ months positive P&L
 *           (proxied via positive total P&L AND positive 30d P&L)
 *  - Elite Mentor: 250+ trades, win rate > 68%
 */
export const computeMentorTier = (s: AuthorStats): MentorTier | null => {
  const trades = s.totalTrades ?? 0;
  const wr = s.winRate ?? 0;
  const totalPnl = s.totalPnl ?? 0;
  const pnl30 = s.pnl30d ?? 0;

  if (trades >= 250 && wr > 68) return MENTOR_TIERS.elite_mentor;
  if (trades >= 120 && wr > 63 && totalPnl > 0 && pnl30 > 0)
    return MENTOR_TIERS.mentor;
  if (trades >= 50 && wr > 58) return MENTOR_TIERS.verified_trader;
  if (trades >= 20 && wr > 50) return MENTOR_TIERS.rising_star;
  return null;
};