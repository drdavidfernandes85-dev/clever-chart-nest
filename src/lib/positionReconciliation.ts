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
  const delays = [1500, 1500, 2000];
  for (const d of delays) {
    await sleep(d);
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
 * After a close request succeeds, poll positions at 1.5s / 3s.
 * If `ticket` is gone from the list, returns "closed". Otherwise "pending".
 */
export async function reconcileAfterClose(
  refresh: RefreshFn,
  getTickets: GetTicketsFn,
  ticket: string | number | null | undefined,
): Promise<"closed" | "pending"> {
  const target = ticket != null ? String(ticket) : null;
  const delays = [1500, 1500];
  for (const d of delays) {
    await sleep(d);
    try { await refresh(); } catch { /* ignore */ }
    fireGlobalRefresh();
    if (target) {
      const tickets = getTickets().map((t) => (t == null ? "" : String(t)));
      if (!tickets.includes(target)) return "closed";
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
