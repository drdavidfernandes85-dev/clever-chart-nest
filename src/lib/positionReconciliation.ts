/**
 * Position reconciliation helpers.
 * After a live open or close, refresh positions on a 1.5s / 3s / 5s cadence
 * and resolve whether the ticket appeared / disappeared as expected.
 */
import { toast } from "sonner";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RefreshFn = () => Promise<unknown> | unknown;
type GetTicketsFn = () => Array<string | number | null | undefined>;

function fireGlobalRefresh() {
  try {
    window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
    window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
    window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
  } catch { /* ignore */ }
}

/**
 * After an order is placed, poll positions at 1.5s / 3s / 5s.
 * If `expectedTicket` appears in the list, returns "confirmed".
 * Otherwise resolves "pending" and the caller should display a
 * "Confirmation pending" message.
 */
export async function reconcileAfterOpen(
  refresh: RefreshFn,
  getTickets: GetTicketsFn,
  expectedTicket: string | number | null | undefined,
): Promise<"confirmed" | "pending"> {
  const target = expectedTicket != null ? String(expectedTicket) : null;
  // Schedule: T+0, +500ms, +1s, +2s, +3.5s, +5s, +8s, +12s, +15s
  const delays = [0, 500, 500, 1000, 1500, 1500, 3000, 4000, 3000];
  for (const d of delays) {
    if (d > 0) await sleep(d);
    try { await refresh(); } catch { /* ignore */ }
    fireGlobalRefresh();
    if (target) {
      const tickets = getTickets().map((t) => (t == null ? "" : String(t)));
      if (tickets.includes(target)) return "confirmed";
    }
  }
  return "pending";
}

/**
 * Poll positions at 0/1.5/3/5/8s after a close request.
 * Returns "closed" only once the ticket actually disappears
 * (or, in partial-close mode, the volume decreases).
 */
export async function reconcileAfterClose(
  refresh: RefreshFn,
  getTickets: GetTicketsFn,
  ticket: string | number | null | undefined,
  opts?: { initialVolume?: number; getVolumeForTicket?: (t: string) => number | null },
): Promise<"closed" | "partial" | "pending"> {
  const target = ticket != null ? String(ticket) : null;
  const delays = [0, 500, 500, 1000, 1500, 1500, 3000, 4000];
  for (const d of delays) {
    if (d > 0) await sleep(d);
    try { await refresh(); } catch { /* ignore */ }
    fireGlobalRefresh();
    if (target) {
      const tickets = getTickets().map((t) => (t == null ? "" : String(t)));
      if (!tickets.includes(target)) return "closed";
      if (opts?.initialVolume != null && opts.getVolumeForTicket) {
        const v = opts.getVolumeForTicket(target);
        if (v != null && v + 1e-9 < opts.initialVolume) return "partial";
      }
    }
  }
  return "pending";
}

export function notifyOpenResult(
  outcome: "confirmed" | "pending",
  symbol: string,
  ticket?: string | number | null,
) {
  if (outcome === "confirmed") {
    toast.success("Position confirmed", { description: `#${ticket ?? ""} ${symbol}`.trim() });
  } else {
    toast.warning("Order placed — confirmation pending", {
      description: "Position not visible yet. Verify in MT5 if it does not appear shortly.",
    });
  }
}
export function notifyCloseResult(
  outcome: "closed" | "pending",
  symbol: string,
  ticket?: string | number | null,
) {
  if (outcome === "closed") {
    toast.success("Position closed successfully", { description: `#${ticket ?? ""} ${symbol}`.trim() });
  } else {
    toast.warning("Close requested — confirmation pending", {
      description: "Position still visible. Verify in MT5 if it does not disappear shortly.",
    });
  }
}
