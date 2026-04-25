import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Share2, X } from "lucide-react";
import { MentorTier } from "@/lib/mentor-tier";
import { TIER_BENEFITS } from "@/lib/mentor-tier-benefits";
import MentorBadge from "./MentorBadge";

interface Props {
  tier: MentorTier | null;
  onClose: () => void;
}

const fireConfetti = () => {
  const end = Date.now() + 1200;
  const colors = ["#FFCD05", "#FFE066", "#FFFFFF", "#FF8A00"];
  const tick = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      startVelocity: 55,
      origin: { x: 0, y: 0.85 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      startVelocity: 55,
      origin: { x: 1, y: 0.85 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  // Initial burst from center
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.45 },
    colors,
    scalar: 1.1,
  });
  tick();
};

const MentorTierCelebration = ({ tier, onClose }: Props) => {
  useEffect(() => {
    if (tier) fireConfetti();
  }, [tier]);

  if (!tier || typeof document === "undefined") return null;
  const Icon = tier.icon;
  const benefits = TIER_BENEFITS[tier.id];

  const shareSignal = async () => {
    const text = `I just unlocked ${tier.label} on IX Live Trading Room! 🎉`;
    if (navigator.share) {
      try {
        await navigator.share({ title: tier.label, text, url: window.location.origin });
      } catch {
        /* user cancelled */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 12 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/40 bg-card shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9),0_0_80px_-12px_hsl(48_100%_51%/0.45)]"
        >
          {/* Fiery glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 70% at 50% 0%, hsl(48 100% 51% / 0.28), transparent 65%), radial-gradient(80% 60% at 50% 100%, hsl(20 100% 55% / 0.18), transparent 70%)",
            }}
          />
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative px-7 pb-6 pt-9 text-center">
            {/* Badge orb */}
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 14 }}
              className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ring-2 ${tier.bg} ${tier.ring} ${tier.text}`}
              style={{ boxShadow: tier.glow }}
            >
              <Icon className="h-11 w-11" strokeWidth={2.2} />
            </motion.div>

            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
              Tier Unlocked
            </p>
            <h2 className="mt-1.5 font-heading text-3xl font-extrabold tracking-tight text-foreground">
              {tier.label}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Congratulations! You've reached <span className="font-semibold text-foreground">{tier.label}</span> status.
            </p>

            <div className="mx-auto mt-3 inline-flex">
              <MentorBadge tier={tier} />
            </div>

            {/* Benefits list */}
            <ul className="mt-5 space-y-1.5 rounded-2xl border border-primary/25 bg-background/40 px-4 py-3 text-left">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[12px] text-foreground/90">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_hsl(48_100%_51%/0.8)]" />
                  {b}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link
                to="/profile"
                onClick={onClose}
                className="flex h-11 items-center justify-center rounded-xl bg-primary font-heading text-xs font-extrabold uppercase tracking-wider text-background shadow-[0_10px_30px_-8px_hsl(48_100%_51%/0.6)] transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                View My Profile
              </Link>
              <button
                onClick={shareSignal}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/80 font-heading text-xs font-extrabold uppercase tracking-wider text-foreground transition-colors hover:bg-muted/40"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share My Signal
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default MentorTierCelebration;