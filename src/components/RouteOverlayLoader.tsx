import { useEffect } from "react";
import { markFallbackHidden, markFallbackShown } from "@/lib/route-metrics";

/**
 * Overlay loader shown while a lazy route chunk is downloading.
 * Sits above the previously-rendered page (which PageTransition keeps
 * mounted) so the user never sees a fullscreen black flash.
 */
const RouteOverlayLoader = () => {
  useEffect(() => {
    markFallbackShown();
    return () => markFallbackHidden();
  }, []);

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[60] flex items-center gap-2 rounded-full border border-primary/40 bg-black/70 px-3 py-1.5 backdrop-blur-md shadow-[0_0_20px_hsl(45_100%_50%/0.25)]"
      role="status"
      aria-label="Loading next page"
    >
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-xs font-medium text-white/85">Loading…</span>
    </div>
  );
};

export default RouteOverlayLoader;
