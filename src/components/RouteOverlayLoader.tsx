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
      className="pointer-events-none fixed top-4 right-4 z-[60] flex items-center gap-2 rounded-full border border-[#FFCD05]/45 bg-[#0B0B0C]/85 px-3 py-1.5 backdrop-blur-md shadow-[0_0_20px_rgba(255,205,5,0.3)]"
      role="status"
      aria-label="Loading LTR Terminal Pro"
    >
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#FFCD05] border-t-transparent" />
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F5F5F5]">Loading…</span>
    </div>
  );
};

export default RouteOverlayLoader;
