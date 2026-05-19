import { useIsAdmin } from "@/hooks/useIsAdmin";
import { reviewAccessModeEnabled } from "@/lib/accessMode";
import { ShieldCheck } from "lucide-react";

/**
 * Floating badge shown only to admin/dev users while the temporary
 * review/testing access mode is enabled. Reminds internal users that the
 * $100 balance gate is currently bypassed.
 */
const ReviewAccessBadge = () => {
  const { isAdmin } = useIsAdmin();
  if (!reviewAccessModeEnabled || !isAdmin) return null;

  return (
    <div
      role="status"
      aria-label="Review Access Mode Active"
      className="fixed bottom-3 right-3 z-[60] hidden md:flex items-center gap-2 rounded-full border border-primary/50 bg-background/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-[0_0_20px_hsl(45_100%_50%/0.35)] backdrop-blur"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Review Access Mode Active
    </div>
  );
};

export default ReviewAccessBadge;
