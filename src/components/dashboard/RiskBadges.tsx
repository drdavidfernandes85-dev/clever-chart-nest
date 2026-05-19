import { cn } from "@/lib/utils";
import { useRiskSettings } from "@/hooks/useRiskSettings";
import { useRateLimit } from "@/hooks/useLiveMarketData";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Compact terminal badges reflecting current risk posture:
 *   LIVE ENABLED · TESTING MODE · KILL SWITCH ACTIVE · RISK BLOCKED
 * Plus pass-through RATE LIMITED from useRateLimit().
 */
const Pill = ({ tone, children }: { tone: "ok" | "warn" | "danger" | "muted"; children: React.ReactNode }) => {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : tone === "danger"
      ? "border-red-500/40 bg-red-500/10 text-red-300 animate-pulse"
      : "border-neutral-700 bg-neutral-900 text-neutral-400";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em]",
        cls,
      )}
    >
      {children}
    </span>
  );
};

const RiskBadges = ({ className }: { className?: string }) => {
  const { settings, flags } = useRiskSettings();
  const rl = useRateLimit();
  const { t } = useLanguage();
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {flags.killSwitch ? (
        <Pill tone="danger">{t("status.killSwitchActive" as never)}</Pill>
      ) : flags.liveEnabled ? (
        <Pill tone="ok">{t("status.liveEnabled" as never)}</Pill>
      ) : (
        <Pill tone="muted">{t("status.liveDisabled" as never)}</Pill>
      )}
      {settings.testing_mode_enabled && <Pill tone="warn">{t("status.testingMode" as never)}</Pill>}
      {rl.active && <Pill tone="danger">{t("status.rateLimited" as never)}</Pill>}
    </div>
  );
};

export default RiskBadges;
