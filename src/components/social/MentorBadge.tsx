import { MentorTier } from "@/lib/mentor-tier";

interface Props {
  tier: MentorTier;
  /** "chip" = bg + icon + label; "icon" = compact icon-only pill. */
  variant?: "chip" | "icon";
  className?: string;
}

/**
 * Visual badge for a mentor tier. Use next to author names everywhere a
 * verified trader appears (signals, chat, leaderboard).
 */
const MentorBadge = ({ tier, variant = "chip", className = "" }: Props) => {
  const Icon = tier.icon;

  if (variant === "icon") {
    return (
      <span
        title={tier.label}
        aria-label={tier.label}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ring-1 ${tier.bg} ${tier.ring} ${tier.text} ${className}`}
        style={{ boxShadow: tier.glow }}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      title={tier.label}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-wider ring-1 ${tier.bg} ${tier.ring} ${tier.text} ${className}`}
      style={{ boxShadow: tier.glow }}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      {tier.short}
    </span>
  );
};

export default MentorBadge;