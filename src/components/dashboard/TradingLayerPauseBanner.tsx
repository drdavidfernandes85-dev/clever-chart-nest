import { useEffect, useState } from "react";
import { PauseCircle } from "lucide-react";
import { getCooldownRemainingMs } from "@/lib/tradingLayerControl";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Production behaviour:
 *  - The old "Execution testing mode active — live refresh paused" banner
 *    is removed. Live refresh is enabled site-wide.
 *  - This component now ONLY surfaces an active Trading Layer 429 cooldown,
 *    and only to admin/dev users, so ordinary production users never see
 *    an internal throttle indicator. Normal users get the silent
 *    coordinator + last-known-good values instead.
 */
const TradingLayerPauseBanner = () => {
  const { isAdmin } = useIsAdmin();
  const [remaining, setRemaining] = useState(getCooldownRemainingMs());

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(getCooldownRemainingMs()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!isAdmin) return null;
  if (remaining <= 0) return null;

  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-1.5 text-[11px] font-mono"
      style={{
        background: "rgba(255, 205, 5, 0.08)",
        borderColor: "rgba(255, 205, 5, 0.35)",
        color: "#FFCD05",
      }}
    >
      <PauseCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="uppercase tracking-wider">
        Trading Layer cooldown · retrying in {Math.ceil(remaining / 1000)}s
      </span>
      <span className="ml-auto text-[10px] opacity-70">admin only</span>
    </div>
  );
};

export default TradingLayerPauseBanner;
