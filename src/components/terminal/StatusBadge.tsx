import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldOff, Hourglass, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Canonical execution-lifecycle statuses for LTR Terminal Pro.
 * Use the same status string everywhere (execution log, modals, journal, audit)
 * so wording stays consistent across the terminal.
 */
export type ExecStatus =
  | "position_confirmed"
  | "broker_accepted"
  | "execution_unconfirmed"
  | "position_closed"
  | "rate_limited"
  | "risk_blocked"
  | "rejected"
  | "pending";

const TONE: Record<ExecStatus, { tone: string; Icon: typeof CheckCircle2; key: string }> = {
  position_confirmed: { tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", Icon: CheckCircle2, key: "status.positionConfirmed" },
  broker_accepted:    { tone: "border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[#FFCD05]",       Icon: Hourglass,    key: "status.brokerAccepted" },
  execution_unconfirmed: { tone: "border-amber-500/40 bg-amber-500/10 text-amber-300",     Icon: AlertTriangle, key: "status.executionUnconfirmed" },
  position_closed:    { tone: "border-neutral-700 bg-neutral-800/40 text-neutral-300",     Icon: Lock,         key: "status.positionClosed" },
  rate_limited:       { tone: "border-orange-500/40 bg-orange-500/10 text-orange-300",     Icon: Clock,        key: "status.rateLimited" },
  risk_blocked:       { tone: "border-red-500/40 bg-red-500/10 text-red-300",              Icon: ShieldOff,    key: "status.riskBlocked" },
  rejected:           { tone: "border-red-500/40 bg-red-500/10 text-red-300",              Icon: XCircle,      key: "status.rejected" },
  pending:            { tone: "border-neutral-700 bg-neutral-800/40 text-neutral-300",     Icon: Hourglass,    key: "status.pending" },
};

/** Normalize various raw status strings → canonical ExecStatus. */
export function normalizeExecStatus(raw: string | null | undefined): ExecStatus {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return "pending";
  if (s === "position_confirmed" || s === "confirmed" || s === "done" || s === "executed" || s === "filled") return "position_confirmed";
  if (s === "placed" || s === "broker_accepted" || s === "accepted" || s === "sent") return "broker_accepted";
  if (s === "pending_verification" || s === "execution_unconfirmed" || s === "unconfirmed") return "execution_unconfirmed";
  if (s === "closed" || s === "position_closed") return "position_closed";
  if (s === "rate_limited" || s === "429" || s === "throttled") return "rate_limited";
  if (s === "risk_blocked" || s === "blocked" || s === "pre_trade_blocked") return "risk_blocked";
  if (s === "rejected" || s === "failed" || s === "error") return "rejected";
  return "pending";
}

interface Props {
  status: ExecStatus | string;
  size?: "xs" | "sm";
  className?: string;
  withIcon?: boolean;
}

const StatusBadge = ({ status, size = "xs", className, withIcon = true }: Props) => {
  const { t } = useLanguage();
  const key = (Object.keys(TONE) as ExecStatus[]).includes(status as ExecStatus)
    ? (status as ExecStatus)
    : normalizeExecStatus(status as string);
  const cfg = TONE[key];
  const Icon = cfg.Icon;
  const sizing =
    size === "sm"
      ? "px-2 py-[3px] text-[10px] gap-1.5"
      : "px-1.5 py-[1px] text-[9px] gap-1";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border font-mono font-bold uppercase tracking-[0.14em]",
        sizing,
        cfg.tone,
        className,
      )}
    >
      {withIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-2.5 w-2.5"} />}
      {t(cfg.key as never)}
    </span>
  );
};

export default StatusBadge;
