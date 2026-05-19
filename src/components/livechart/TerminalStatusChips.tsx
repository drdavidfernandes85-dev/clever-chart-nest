import { useLiveAccount } from "@/contexts/LiveAccountContext";
import { useMarketStatus, useRateLimit } from "@/hooks/useLiveMarketData";
import { reviewAccessModeEnabled } from "@/lib/accessMode";

/**
 * Consolidated status chip strip for the terminal header.
 * Replaces multiple loud warning bars with a single thin row of chips:
 *  - LIVE / TEST MODE / REVIEW MODE
 *  - CONNECTED / DISCONNECTED
 *  - STALE / RATE LIMITED (only when active)
 */
const TerminalStatusChips = () => {
  const { connected, liveAccount } = useLiveAccount();
  const status = useMarketStatus();
  const rl = useRateLimit();

  const isTest = !!(liveAccount as any)?.isDemo || (liveAccount as any)?.accountType === "demo";
  const modeChip = reviewAccessModeEnabled
    ? { label: "REVIEW", tone: "amber" as const }
    : isTest
      ? { label: "TEST", tone: "amber" as const }
      : { label: "LIVE", tone: "emerald" as const };

  const tones: Record<string, string> = {
    emerald:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    neutral: "border-[#2A2D31] bg-[#0A0B0D] text-[#8E949C]",
  };

  const Chip = ({
    label,
    tone,
    dot,
  }: {
    label: string;
    tone: keyof typeof tones;
    dot?: boolean;
  }) => (
    <span
      className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-sm border font-mono text-[9px] uppercase tracking-[0.18em] ${tones[tone]}`}
    >
      {dot && (
        <span
          className={`inline-flex h-1.5 w-1.5 rounded-full ${
            tone === "emerald"
              ? "bg-emerald-500"
              : tone === "amber"
                ? "bg-amber-500"
                : tone === "red"
                  ? "bg-red-500"
                  : "bg-neutral-500"
          }`}
        />
      )}
      {label}
    </span>
  );

  return (
    <div className="flex items-center gap-1.5">
      <Chip label={modeChip.label} tone={modeChip.tone} dot />
      <Chip
        label={connected ? "CONNECTED" : "OFFLINE"}
        tone={connected ? "emerald" : "neutral"}
        dot
      />
      {status === "stale" && <Chip label="STALE" tone="amber" />}
      {rl.active && <Chip label="RATE LIMITED" tone="amber" />}
    </div>
  );
};

export default TerminalStatusChips;
