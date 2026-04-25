import { MentorTierId } from "./mentor-tier";

export const TIER_BENEFITS: Record<MentorTierId, string[]> = {
  rising_star: [
    "Silver star next to your name in chat & signals",
    "Unlocks the Mentor leaderboard track",
    "Priority visibility on shared signals",
  ],
  verified_trader: [
    "Blue verified check across the platform",
    "Your signals appear in the Hot Right Now rail",
    "Can host group rooms with up to 25 traders",
  ],
  mentor: [
    "Premium gold Mentor badge",
    "Your signals are featured in Live Shared Signals",
    "Eligible for revenue share on copied trades",
  ],
  elite_mentor: [
    "Legendary purple Elite badge with glow",
    "Top placement in every mentor list",
    "Direct DM access from the entire community",
    "Highest revenue share tier",
  ],
};