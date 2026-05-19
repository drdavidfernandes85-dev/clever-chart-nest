/**
 * Friendly labels for execution_audit_events.status and .raw.classification.
 * Used by the audit panel and any client-side toast/log surface.
 */
export const AUDIT_STATUS_LABELS: Record<string, string> = {
  dry_run: "Dry Run",
  placed: "Order Placed",
  position_confirmed: "Position Confirmed",
  filled: "Order Filled",
  done: "Order Filled",
  modified: "Protection Updated",
  modify_failed: "Modify Failed",
  modify_rejected: "Modify Rejected",
  closed: "Position Closed",
  close_failed: "Close Failed",
  close_rejected: "Close Rejected",
  rejected: "Order Rejected",
  rate_limited: "Rate Limited",
  blocked: "Blocked",
};

export const AUDIT_CLASSIFICATION_LABELS: Record<string, string> = {
  dry_run: "Dry Run",
  placed: "Order Placed",
  placed_confirmed: "Position Confirmed",
  close_position: "Close Position",
  modify_position: "Modify SL / TP",
  rate_limited: "Rate Limited",
  blocked: "Blocked",
};

export const prettyAuditStatus = (s?: string | null): string =>
  s ? (AUDIT_STATUS_LABELS[s] ?? s) : "—";
export const prettyAuditClassification = (s?: string | null): string =>
  s ? (AUDIT_CLASSIFICATION_LABELS[s] ?? s) : "—";
