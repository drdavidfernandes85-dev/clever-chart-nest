import { ShieldCheck } from "lucide-react";

/**
 * Compact status chip row replacing the previous large warning banner.
 *
 * Large banners are reserved for blocking states only:
 *   - Kill Switch Active
 *   - MT5 Disconnected
 *   - Rate Limited
 *   - Trading Disabled
 *
 * Routine state (live execution mode, test caps) is shown as quiet chips.
 */
const LiveExecutionBanner = () => {
  const Chip = ({
    label,
    tone,
    dot,
  }: {
    label: string;
    tone: "emerald" | "amber" | "neutral";
    dot?: boolean;
  }) => {
    const tones = {
      emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      neutral: "border-[#1c1f23] bg-[#0A0B0D] text-[#8E949C]",
    } as const;
    const dotTone = {
      emerald: "bg-emerald-500",
      amber: "bg-amber-500",
      neutral: "bg-neutral-500",
    } as const;
    return (
      <span
        className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-sm border font-mono text-[9px] uppercase tracking-[0.18em] ${tones[tone]}`}
      >
        {dot && (
          <span className={`inline-flex h-1 w-1 rounded-full ${dotTone[tone]}`} />
        )}
        {label}
      </span>
    );
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#0A0B0D]/60">
      <ShieldCheck className="h-3 w-3 text-[#FFCD05]/70 shrink-0" />
      <Chip label="LIVE EXEC" tone="emerald" dot />
      <Chip label="TEST MODE" tone="amber" />
      <Chip label="MAX 0.01 LOT" tone="neutral" />
    </div>
  );
};

export default LiveExecutionBanner;
