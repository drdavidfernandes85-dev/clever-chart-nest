import { useEffect, useState } from "react";
import { useLiveAccount } from "@/contexts/LiveAccountContext";
import { useQuote, useMarketStatus, useRateLimit } from "@/hooks/useLiveMarketData";

interface Props {
  selectedSymbol: string;
  displayLabel?: string;
}

/**
 * Bank-terminal style bottom status bar.
 * Replaces the verbose compliance footer with a thin, data-rich strip.
 */
const TerminalStatusBar = ({ selectedSymbol, displayLabel }: Props) => {
  const { connected } = useLiveAccount();
  const quote = useQuote(selectedSymbol);
  const status = useMarketStatus();
  const rl = useRateLimit();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const tickAge =
    quote?.timestamp != null
      ? Math.max(0, Math.floor((now - quote.timestamp) / 1000))
      : null;
  const tickAgeLabel =
    tickAge == null
      ? "—"
      : tickAge < 60
        ? `${tickAge}s`
        : tickAge < 3600
          ? `${Math.floor(tickAge / 60)}m`
          : `${Math.floor(tickAge / 3600)}h`;

  const Item = ({
    label,
    value,
    tone = "neutral",
  }: {
    label: string;
    value: React.ReactNode;
    tone?: "neutral" | "good" | "warn" | "bad";
  }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[#5d6168] uppercase tracking-[0.18em]">{label}</span>
      <span
        className={`tabular-nums ${
          tone === "good"
            ? "text-emerald-400"
            : tone === "warn"
              ? "text-amber-400"
              : tone === "bad"
                ? "text-red-400"
                : "text-[#C9CDD2]"
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="mt-3 flex items-center gap-4 px-3 h-7 rounded-md border border-[#1a1c1f] bg-[#070708] font-mono text-[9px] uppercase">
      <Item
        label="Conn"
        value={connected ? "Online" : "Offline"}
        tone={connected ? "good" : "bad"}
      />
      <span className="text-[#1a1c1f]">·</span>
      <Item label="Venue" value="INFINOX MT5" />
      <span className="text-[#1a1c1f]">·</span>
      <Item label="Sym" value={displayLabel || selectedSymbol || "—"} />
      <span className="text-[#1a1c1f]">·</span>
      <Item
        label="Tick"
        value={tickAgeLabel}
        tone={status === "stale" ? "warn" : "neutral"}
      />
      <span className="text-[#1a1c1f]">·</span>
      <Item
        label="Rate"
        value={rl.active ? "Limited" : "OK"}
        tone={rl.active ? "warn" : "good"}
      />
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[#5d6168] normal-case tracking-normal">
          Powered by Trading Layer
        </span>
        <span className="text-[#3f4348]">·</span>
        <span className="text-[#5d6168]">LTR Terminal Pro</span>
      </div>
    </div>
  );
};

export default TerminalStatusBar;
