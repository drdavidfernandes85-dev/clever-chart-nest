import { useEffect, useState } from "react";
import { Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineCount } from "@/hooks/useOnlineCount";

interface Props {
  /** Compact = single-row variant for embedding above widgets. */
  compact?: boolean;
  className?: string;
}

/**
 * Community Trust Bar — regulation-compliant social proof strip.
 * Online count is live Supabase Realtime presence; member count is the
 * real profiles row count.
 */
const CommunityTrustBar = ({ compact = false, className = "" }: Props) => {
  const onlineNow = useOnlineCount();
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true });
      if (!cancelled && count != null) setMemberCount(count);
    })();
    return () => { cancelled = true; };
  }, []);



  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card/80 to-card/60 backdrop-blur-xl ${
        compact ? "px-3 py-2.5 sm:px-4" : "px-4 py-3 sm:px-5 sm:py-4"
      } shadow-[0_10px_40px_-15px_hsl(48_100%_51%/0.45)] ${className}`}
    >
      {/* Subtle glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 0% 50%, hsl(48 100% 51% / 0.12), transparent 60%)",
        }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        {/* Tagline */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <p
            className={`min-w-0 truncate text-foreground ${
              compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
            }`}
          >
            <span className="font-semibold">
              Join a professional community
            </span>{" "}
            <span className="text-muted-foreground">
              of active traders sharing ideas and learning together
            </span>
          </p>
        </div>

        {/* Stats */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[10px] font-bold tabular-nums text-emerald-400 sm:text-[11px]">
              {onlineNow == null ? "…" : onlineNow}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/80 sm:text-[10px]">
              online now
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1">
            <Users className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px] font-bold tabular-nums text-primary sm:text-[11px]">
              {memberCount == null ? "…" : memberCount.toLocaleString()}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-primary/80 sm:text-[10px]">
              traders & mentors
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityTrustBar;
