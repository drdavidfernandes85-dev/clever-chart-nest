import { X, CheckCircle2, ShieldAlert, AlertOctagon, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
      title: "Order Executed",
      Icon: CheckCircle2,
      ring: "border-emerald-500/50",
      chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      bar: "bg-emerald-500/70",
    },
    blocked: {
      title: "Order Blocked by Best Execution Controls",
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
  const digits = result.digits ?? 5;
  const sideLabel = result.side === "buy" ? "BUY" : "SELL";
  const sideAccent = result.side === "buy" ? "text-emerald-300" : "text-red-300";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-[min(420px,92vw)] rounded-sm border bg-[#0a0a0a] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden",
          result.outcome === "success" && "border-emerald-500/30",
          result.outcome === "blocked" && "border-amber-500/30",
          result.outcome === "rejected" && "border-red-500/30",
        )}
      >
        <TitleBar outcome={result.outcome} onClose={onClose} />

        <div className="px-3 py-2">
          {result.outcome === "success" && (
            <>
              <Row label="Symbol" value={result.symbol} accent="text-[#FFCD05]" />
              <Row label="Side" value={sideLabel} accent={sideAccent} />
              <Row label="Volume" value={result.volume.toFixed(2)} />
              <Row label="Requested Price" value={fmtPx(result.requestedPrice, digits)} />
              <Row
                label="Executed Price"
                value={fmtPx(result.executedPrice, digits)}
                accent="text-neutral-50 font-semibold"
              />
              <Row
                label="Slippage"
                value={fmtSlip(result.slippage, digits)}
                accent={
                  result.slippage != null && Number(result.slippage) !== 0
                    ? Number(result.slippage) < 0
                      ? "text-emerald-300"
                      : "text-amber-300"
                    : undefined
                }
              />
              <Row label="Latency" value={fmtMs(result.latencyMs)} />
              <Row label="Broker Message" value={result.brokerMessage || "—"} />
              <Row
                label="Status"
                value={(result.status || "DONE").toString().toUpperCase()}
                accent="text-emerald-300"
              />
              {result.ticket != null && (
                <Row label="Ticket" value={`#${result.ticket}`} />
              )}
            </>
          )}

          {result.outcome === "blocked" && (
            <>
              <Row
                label="Reason"
                value={result.reason || "Pre-trade check failed"}
                accent="text-amber-300"
              />
              <Row label="Symbol" value={result.symbol} accent="text-[#FFCD05]" />
              <Row label="Bid" value={fmtPx(result.bid, digits)} accent="text-red-300" />
              <Row label="Ask" value={fmtPx(result.ask, digits)} accent="text-emerald-300" />
              <Row label="Spread" value={fmtPx(result.spread, digits)} />
              <Row label="Tick Age" value={fmtMs(result.tickAgeMs)} />
              <Row label="Volume" value={result.volume.toFixed(2)} />
              <Row
                label="Rule Violated"
                value={result.ruleViolated || "—"}
                accent="text-amber-300"
              />
            </>
          )}

          {result.outcome === "rejected" && (
            <>
              <Row
                label="Broker Message"
                value={result.brokerMessage || "Order rejected"}
                accent="text-red-300"
              />
              <Row label="Retcode" value={result.retcode != null ? String(result.retcode) : "—"} />
              <Row label="Symbol" value={result.symbol} accent="text-[#FFCD05]" />
              <Row label="Side" value={sideLabel} accent={sideAccent} />
              <Row label="Requested Price" value={fmtPx(result.requestedPrice, digits)} />
              <Row label="Quote Bid" value={fmtPx(result.quoteBid ?? result.bid, digits)} accent="text-red-300" />
              <Row label="Quote Ask" value={fmtPx(result.quoteAsk ?? result.ask, digits)} accent="text-emerald-300" />
              <Row label="Latency" value={fmtMs(result.latencyMs)} />
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
