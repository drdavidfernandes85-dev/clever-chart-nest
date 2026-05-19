import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMarketStatus, useRateLimit } from "@/hooks/useLiveMarketData";

/**
 * Visual status badge for the centralized market-data layer.
 * Renders one of: LIVE STREAM · LIVE POLLING · STALE · RATE LIMITED · DISCONNECTED.
 * When rate-limited, shows a live countdown.
 */
const MarketStatusBadge = ({ className }: { className?: string }) => {
  const status = useMarketStatus();
  const rl = useRateLimit();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!rl.active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rl.active]);

  const config: Record<string, { label: string; cls: string; dot: string }> = {
    live_stream: {
      label: "LIVE STREAM",
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      dot: "bg-emerald-400 animate-pulse",
    },
    live_polling: {
      label: "LIVE POLLING",
      cls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
      dot: "bg-emerald-400 animate-pulse",
    },
    stale: {
      label: "STALE",
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      dot: "bg-amber-400",
    },
    rate_limited: {
      label: "RATE LIMITED",
      cls: "border-red-500/40 bg-red-500/10 text-red-300",
      dot: "bg-red-400 animate-pulse",
    },
    disconnected: {
      label: "DISCONNECTED",
      cls: "border-neutral-700 bg-neutral-900 text-neutral-400",
      dot: "bg-neutral-500",
    },
  };
  const c = config[status] ?? config.disconnected;

  const remaining =
    rl.active && rl.resumesAt
      ? Math.max(0, Math.ceil((rl.resumesAt - now) / 1000))
      : 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em]",
        c.cls,
        className,
      )}
      title={
        status === "rate_limited"
          ? `Trading Layer rate limit hit — resuming in ${remaining}s. Cached prices remain visible.`
          : `Market data status: ${c.label}`
      }
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
      {status === "rate_limited" && remaining > 0 && (
        <span className="ml-1 text-red-200">{remaining}s</span>
      )}
    </span>
  );
};

export default MarketStatusBadge;
