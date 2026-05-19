import { X, CheckCircle2, ShieldAlert, AlertOctagon, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge, { type ExecStatus } from "@/components/terminal/StatusBadge";

const outcomeToExecStatus = (outcome: ExecutionOutcome): ExecStatus => {
  switch (outcome) {
    case "success": return "position_confirmed";
    case "blocked": return "risk_blocked";
    case "rejected": return "rejected";
    case "pending": return "broker_accepted";
    case "unconfirmed": return "execution_unconfirmed";
  }
};

export type ExecutionOutcome = "success" | "blocked" | "rejected" | "pending" | "unconfirmed";

export interface ExecutionResultPayload {
  outcome: ExecutionOutcome;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  digits?: number;
  // lifecycle (MT5 truth)
  brokerAccepted?: boolean;
  mt5Confirmed?: boolean;
  confirmationStatus?: "pending" | "confirmed" | "not_found" | "failed";
  confirmedTicket?: number | string | null;
  confirmedEntryPrice?: number | null;
  confirmedVolume?: number | null;
  confirmedAt?: string | null;
  liveOrderSent?: boolean;
  // success
  requestedPrice?: number | null;
  executedPrice?: number | null;
  slippage?: number | null;
  latencyMs?: number | null;
  brokerMessage?: string | null;
  status?: string | null;
  ticket?: number | string | null;
  // blocked
  reason?: string | null;
  ruleViolated?: string | null;
  bid?: number | null;
  ask?: number | null;
  spread?: number | null;
  tickAgeMs?: number | null;
  // rejected
  retcode?: number | string | null;
  quoteBid?: number | null;
  quoteAsk?: number | null;
}

const fmtPx = (n: number | null | undefined, digits = 5) =>
  n == null || !Number.isFinite(Number(n)) ? "—" : Number(n).toFixed(digits);
const fmtMs = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? "—" : `${Math.round(Number(n))} ms`;
const fmtSlip = (n: number | null | undefined, digits = 5) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(digits)}`;

const Row = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
  <div className="flex items-center justify-between gap-3 border-b border-neutral-900/80 py-1.5 last:border-b-0">
    <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-neutral-500">
      {label}
    </span>
    <span className={cn("font-mono text-[11px] tabular-nums text-neutral-100", accent)}>
      {value}
    </span>
  </div>
);

const TitleBar = ({
  outcome,
  onClose,
}: {
  outcome: ExecutionOutcome;
  onClose: () => void;
}) => {
  const config = {
    success: {
      title: "Position Confirmed",
      Icon: CheckCircle2,
      ring: "border-emerald-500/50",
      chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      bar: "bg-emerald-500/70",
    },
    blocked: {
      title: "Risk Blocked — Pre-Trade Controls",
      Icon: ShieldAlert,
      ring: "border-amber-500/50",
      chip: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      bar: "bg-amber-500/70",
    },
    rejected: {
      title: "Broker Rejected Order",
      Icon: AlertOctagon,
      ring: "border-red-500/50",
      chip: "bg-red-500/15 text-red-300 border-red-500/40",
      bar: "bg-red-500/70",
    },
    pending: {
      title: "Order Accepted — MT5 Confirmation Pending",
      Icon: Clock,
      ring: "border-yellow-500/50",
      chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
      bar: "bg-yellow-500/70",
    },
    unconfirmed: {
      title: "Order Accepted — MT5 Confirmation Pending",
      Icon: HelpCircle,
      ring: "border-yellow-500/50",
      chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
      bar: "bg-yellow-500/70",
    },
  }[outcome];
  const { title, Icon, chip, bar } = config;
  return (
    <div className="relative">
      <div className={cn("absolute inset-x-0 top-0 h-[2px]", bar)} />
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded border",
              chip,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-100 truncate">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/80"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ExecutionResultModal = ({
  result,
  onClose,
}: {
  result: ExecutionResultPayload | null;
  onClose: () => void;
}) => {
  if (!result) return null;
  // Hard guard: "ORDER EXECUTED" must only render when an MT5 position ticket
  // was confirmed from live positions. Otherwise downgrade to "unconfirmed".
  const hasMt5Ticket =
    result.confirmedTicket != null || (result.mt5Confirmed === true && result.ticket != null);
  const effective: ExecutionResultPayload =
    result.outcome === "success" && !hasMt5Ticket
      ? {
          ...result,
          outcome: "unconfirmed",
          brokerAccepted: true,
          mt5Confirmed: false,
          confirmationStatus: "not_found",
          brokerMessage: "Broker accepted/sent order but no matching MT5 position was found.",
        }
      : result;
  const digits = effective.digits ?? 5;
  const sideLabel = effective.side === "buy" ? "BUY" : "SELL";
  const sideAccent = effective.side === "buy" ? "text-emerald-300" : "text-red-300";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-[min(420px,92vw)] rounded-sm border bg-[#0a0a0a] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden",
          effective.outcome === "success" && "border-emerald-500/30",
          effective.outcome === "blocked" && "border-amber-500/30",
          effective.outcome === "rejected" && "border-red-500/30",
          (effective.outcome === "pending" || effective.outcome === "unconfirmed") && "border-yellow-500/30",
        )}
      >
        <TitleBar outcome={effective.outcome} onClose={onClose} />

        <div className="px-3 py-2">
          {effective.outcome === "success" && (
            <>
              <Row label="Symbol" value={effective.symbol} accent="text-[#FFCD05]" />
              <Row label="Side" value={sideLabel} accent={sideAccent} />
              <Row label="Volume" value={effective.volume.toFixed(2)} />
              <Row label="Requested Price" value={fmtPx(effective.requestedPrice, digits)} />
              <Row
                label="Executed Price"
                value={fmtPx(effective.executedPrice, digits)}
                accent="text-neutral-50 font-semibold"
              />
              <Row
                label="Slippage"
                value={fmtSlip(effective.slippage, digits)}
                accent={
                  effective.slippage != null && Number(effective.slippage) !== 0
                    ? Number(effective.slippage) < 0
                      ? "text-emerald-300"
                      : "text-amber-300"
                    : undefined
                }
              />
              <Row label="Latency" value={fmtMs(effective.latencyMs)} />
              <Row label="Broker Message" value={effective.brokerMessage || "—"} />
              <Row
                label="Status"
                value={(effective.status || "DONE").toString().toUpperCase()}
                accent="text-emerald-300"
              />
              {effective.ticket != null && (
                <Row label="Ticket" value={`#${effective.ticket}`} />
              )}
            </>
          )}

          {effective.outcome === "blocked" && (
            <>
              <Row
                label="Reason"
                value={effective.reason || "Pre-trade check failed"}
                accent="text-amber-300"
              />
              <Row label="Symbol" value={effective.symbol} accent="text-[#FFCD05]" />
              <Row label="Bid" value={fmtPx(effective.bid, digits)} accent="text-red-300" />
              <Row label="Ask" value={fmtPx(effective.ask, digits)} accent="text-emerald-300" />
              <Row label="Spread" value={fmtPx(effective.spread, digits)} />
              <Row label="Tick Age" value={fmtMs(effective.tickAgeMs)} />
              <Row label="Volume" value={effective.volume.toFixed(2)} />
              <Row
                label="Rule Violated"
                value={effective.ruleViolated || "—"}
                accent="text-amber-300"
              />
            </>
          )}

          {effective.outcome === "rejected" && (
            <>
              <Row
                label="Broker Message"
                value={effective.brokerMessage || "Order rejected"}
                accent="text-red-300"
              />
              <Row label="Retcode" value={effective.retcode != null ? String(effective.retcode) : "—"} />
              <Row label="Symbol" value={effective.symbol} accent="text-[#FFCD05]" />
              <Row label="Side" value={sideLabel} accent={sideAccent} />
              <Row label="Requested Price" value={fmtPx(effective.requestedPrice, digits)} />
              <Row label="Quote Bid" value={fmtPx(effective.quoteBid ?? effective.bid, digits)} accent="text-red-300" />
              <Row label="Quote Ask" value={fmtPx(effective.quoteAsk ?? effective.ask, digits)} accent="text-emerald-300" />
              <Row label="Latency" value={fmtMs(effective.latencyMs)} />
            </>
          )}

          {(effective.outcome === "pending" || effective.outcome === "unconfirmed") && (
            <>
              <Row label="Symbol" value={effective.symbol} accent="text-[#FFCD05]" />
              <Row label="Side" value={sideLabel} accent={sideAccent} />
              <Row label="Volume" value={effective.volume.toFixed(2)} />
              <Row
                label="Broker Accepted"
                value={effective.brokerAccepted ? "YES" : "—"}
                accent={effective.brokerAccepted ? "text-emerald-300" : undefined}
              />
              <Row
                label="MT5 Confirmed"
                value={effective.mt5Confirmed ? "YES" : "NO"}
                accent={effective.mt5Confirmed ? "text-emerald-300" : "text-yellow-300"}
              />
              <Row
                label="Confirmation"
                value={(effective.confirmationStatus || "pending").toUpperCase()}
                accent={
                  effective.confirmationStatus === "confirmed"
                    ? "text-emerald-300"
                    : effective.confirmationStatus === "not_found" || effective.confirmationStatus === "failed"
                    ? "text-yellow-300"
                    : "text-yellow-300"
                }
              />
              <Row
                label="Confirmed Ticket"
                value={effective.confirmedTicket != null ? `#${effective.confirmedTicket}` : "—"}
              />
              <Row
                label="Confirmed Entry"
                value={fmtPx(effective.confirmedEntryPrice, digits)}
              />
              <Row
                label="Status"
                value={
                  effective.outcome === "pending"
                    ? "ORDER SENT — WAITING FOR MT5"
                    : "NO MATCHING MT5 POSITION"
                }
                accent="text-yellow-300"
              />
              <Row
                label="Broker Message"
                value={
                  effective.outcome === "unconfirmed"
                    ? "Broker accepted/sent order but no matching MT5 position was found."
                    : (effective.brokerMessage ||
                       "Order sent — waiting for MT5 confirmation.")
                }
              />
              {Number(effective.retcode) === 10008 && (
                <Row
                  label="Retcode 10008"
                  value="MT5 retcode 10008 means order placed/accepted, not necessarily executed."
                  accent="text-yellow-300"
                />
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-3 py-2 bg-[#070707]">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-300 hover:text-neutral-50 hover:border-neutral-500"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExecutionResultModal;
