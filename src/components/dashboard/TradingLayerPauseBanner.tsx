import { useEffect, useState } from "react";
import { AlertTriangle, PauseCircle } from "lucide-react";
import { getCooldownRemainingMs } from "@/lib/tradingLayerControl";

/**
 * Terminal-wide banner shown while live auto-refresh is paused for
 * Best-Execution testing. Also surfaces the active 429 cooldown countdown.
 */
const TradingLayerPauseBanner = () => {
  const [remaining, setRemaining] = useState(getCooldownRemainingMs());

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(getCooldownRemainingMs()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cooling = remaining > 0;

  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-1.5 text-[11px] font-mono"
      style={{
        background: "rgba(255, 205, 5, 0.08)",
        borderColor: "rgba(255, 205, 5, 0.35)",
        color: "#FFCD05",
      }}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="uppercase tracking-wider">
        Execution testing mode active — live refresh paused.
      </span>
      {cooling && (
        <span className="ml-auto flex items-center gap-1.5 text-[10px]">
          <PauseCircle className="h-3 w-3" />
          Rate limit reached. Retrying in {Math.ceil(remaining / 1000)}s.
        </span>
      )}
    </div>
  );
};

export default TradingLayerPauseBanner;
