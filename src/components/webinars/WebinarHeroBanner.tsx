import { motion, AnimatePresence } from "framer-motion";
import { Radio, Clock, Calendar, ArrowRight, User as UserIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useWebinars, useCountdown } from "@/hooks/useWebinars";

/**
 * Flagship hero on the Dashboard. Always renders something:
 *  - LIVE NOW (red, pulsing) if a session is live
 *  - Countdown card if a future session is scheduled
 *  - Quiet "schedule" placeholder otherwise (still discoverable)
 */
const WebinarHeroBanner = () => {
  const { liveNow, upcoming } = useWebinars();
  const target = liveNow ? null : upcoming?.scheduled_at ?? null;
  const { label: countdown } = useCountdown(target);

  // Nothing scheduled — keep a low-key card so the feature stays visible
  if (!liveNow && !upcoming) {
    return (
      <Link
        to="/webinars"
        className="block group rounded-3xl border border-border/40 bg-gradient-to-r from-card via-card to-primary/5 px-5 py-4 hover:border-primary/40 transition-colors"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold text-foreground">
                No live webinar right now
              </p>
              <p className="text-xs text-muted-foreground">
                Browse past recordings & set reminders for upcoming sessions.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-primary group-hover:translate-x-0.5 transition-transform">
            Library <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    );
  }

  const isLive = !!liveNow;
  const w = liveNow ?? upcoming!;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isLive ? "live" : "soon"}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35 }}
        className={`relative overflow-hidden rounded-3xl border ${
          isLive
            ? "border-destructive/50 bg-gradient-to-r from-destructive/15 via-destructive/8 to-destructive/15"
            : "border-primary/40 bg-gradient-to-r from-primary/12 via-primary/5 to-primary/12"
        } px-5 sm:px-7 py-5 sm:py-6 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)]`}
      >
        {/* glow */}
        <div
          className={`pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full blur-3xl ${
            isLive ? "bg-destructive/30" : "bg-primary/25"
          }`}
        />
        {isLive && (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-destructive/[0.04]" />
        )}

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
          {/* Left — status + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2.5">
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-destructive-foreground shadow-[0_0_20px_hsl(var(--destructive)/0.6)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive-foreground" />
                  </span>
                  Live now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 border border-primary/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Clock className="h-3 w-3" />
                  Live in {countdown}
                </span>
              )}
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Daily Webinar
              </span>
            </div>

            <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight mb-1.5 line-clamp-2">
              {w.title}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-foreground font-medium">{w.host_name}</span>
              </span>
              {w.topic && (
                <span className="inline-flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-primary" />
                  {w.topic}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {new Date(w.scheduled_at).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* Right — primary CTA */}
          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            {isLive ? (
              <a
                href={w.stream_url ?? `/webinars/${w.id}`}
                target={w.stream_url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-3 font-heading text-sm font-bold uppercase tracking-wider text-destructive-foreground shadow-[0_15px_40px_-10px_hsl(var(--destructive)/0.7)] hover:scale-[1.02] active:scale-95 transition-transform"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive-foreground" />
                </span>
                Join Webinar Now
              </a>
            ) : (
              <Link
                to={`/webinars/${w.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-heading text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_15px_40px_-10px_hsl(var(--primary)/0.6)] hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Set reminder
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link
              to="/webinars"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              All sessions
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WebinarHeroBanner;
