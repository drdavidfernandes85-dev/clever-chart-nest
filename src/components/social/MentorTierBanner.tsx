import { Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { MentorTier } from "@/lib/mentor-tier";
import MentorBadge from "./MentorBadge";

interface Props {
  tier: MentorTier | null;
  userId?: string | null;
}

const dismissKey = (uid: string, id: string) =>
  `mentor_tier_banner_dismissed:${uid}:${id}`;

/**
 * Subtle dashboard banner that celebrates the user's current mentor tier
 * until they dismiss it. Re-appears whenever a higher tier is reached.
 */
const MentorTierBanner = ({ tier, userId }: Props) => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!tier || !userId) {
      setDismissed(true);
      return;
    }
    setDismissed(
      window.localStorage.getItem(dismissKey(userId, tier.id)) === "1",
    );
  }, [tier, userId]);

  if (!tier || !userId || dismissed) return null;

  const close = () => {
    window.localStorage.setItem(dismissKey(userId, tier.id), "1");
    setDismissed(true);
  };

  return (
    <div
      className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/30 bg-card/70 px-4 py-2.5 backdrop-blur-xl"
      style={{ boxShadow: tier.glow }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, hsl(48 100% 51% / 0.10) 0%, transparent 60%)",
        }}
      />
      <div className="relative flex min-w-0 items-center gap-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 truncate text-sm text-foreground">
          You're a <span className="font-bold text-primary">{tier.label}</span>{" "}
          — keep stacking wins to climb the next tier.
        </p>
        <MentorBadge tier={tier} />
      </div>
      <div className="relative flex shrink-0 items-center gap-1">
        <Link
          to="/profile"
          className="rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10"
        >
          View Profile
        </Link>
        <button
          onClick={close}
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default MentorTierBanner;