import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWebinars } from "@/hooks/useWebinars";

/**
 * Persistent floating "Join Live" chip — visible on every authenticated route
 * while a webinar status is 'live'. The user can dismiss it for the current
 * session via the X (state held in memory only).
 */
const FloatingJoinLive = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const shouldCheckLive = !!user && pathname !== "/" && pathname !== "/login" && pathname !== "/register" && !pathname.startsWith("/webinars");
  const { liveNow } = useWebinars(shouldCheckLive);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when the live session changes
  useEffect(() => {
    setDismissed(false);
  }, [liveNow?.id]);

  // Hide on the dedicated webinar page (would be redundant) and on auth pages
  const hide =
    !user ||
    !liveNow ||
    dismissed ||
    pathname.startsWith("/webinars") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/";

  return (
    <AnimatePresence>
      {!hide && liveNow && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-40 max-w-[calc(100vw-2rem)]"
        >
          <div className="group relative flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive px-3 py-2.5 sm:px-4 sm:py-3 shadow-[0_20px_60px_-15px_hsl(var(--destructive)/0.7)] backdrop-blur-xl">
            {/* Pulsing live dot */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive-foreground" />
            </span>

            <a
              href={liveNow.stream_url ?? `/webinars/${liveNow.id}`}
              target={liveNow.stream_url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="flex items-center gap-2 min-w-0"
            >
              <Radio className="h-4 w-4 text-destructive-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-destructive-foreground/85 leading-none">
                  Live now
                </p>
                <p className="text-xs sm:text-sm font-bold text-destructive-foreground line-clamp-1">
                  Join {liveNow.host_name}
                </p>
              </div>
            </a>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setDismissed(true);
              }}
              aria-label="Dismiss"
              className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive-foreground/10 text-destructive-foreground/70 hover:bg-destructive-foreground/20 hover:text-destructive-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingJoinLive;
