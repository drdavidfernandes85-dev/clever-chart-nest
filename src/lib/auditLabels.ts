/**
 * Friendly labels for execution_audit_events.status and .raw.classification.
 * Used by the audit panel and any client-side toast/log surface.
 */
export const AUDIT_STATUS_LABELS: Record<string, string> = {
  dry_run: "Dry Run",
  placed: "Broker Accepted / Confirmation Pending",
  broker_accepted_pending_confirmation: "Broker Accepted / Confirmation Pending",
  position_confirmed: "Position Confirmed in MT5",
  confirmation_delayed_rate_limited: "Confirmation Delayed — Rate Limited",
  unconfirmed_after_reconciliation: "MT5 Confirmation Not Found",
  order_found_not_filled: "Order Found — Not Filled",
  pending_order_placed: "Pending Order Placed",
  execution_unconfirmed: "Waiting for MT5 Confirmation",
  filled: "Order Filled",
  done: "Order Filled",
  protection_modified: "SL/TP Updated",
  protection_failed: "SL/TP Failed",
  protection_rejected: "SL/TP Rejected",
  protection_blocked: "SL/TP Blocked",
  // legacy aliases (kept for old rows)
  modified: "SL/TP Updated",
  modify_failed: "SL/TP Failed",
  modify_rejected: "SL/TP Rejected",
  closed: "Position Closed in MT5",
  close_unconfirmed: "Close Sent but Position Still Open",
  partial_closed: "Partial Close",
  close_failed: "Close Failed",
  close_rejected: "Close Rejected",
  rejected: "Order Rejected",
  rate_limited: "Rate Limited",
  blocked: "Blocked",
};

export const AUDIT_CLASSIFICATION_LABELS: Record<string, string> = {
  dry_run: "Dry Run",
  placed: "Order Placed",
  broker_accepted: "Broker Accepted",
  confirmation_pending: "Waiting for MT5 Confirmation",
  placed_confirmed: "Position Confirmed",
  placed_unconfirmed: "Placed (Unconfirmed)",
  confirmation_delayed_rate_limited: "Delayed by API Rate Limit",
  unconfirmed_after_reconciliation: "Unconfirmed After Source Checks",
  order_found_not_filled: "Order Found — Not Filled",
  pending_order: "Pending Order",
  close_position: "Close Position",
  modify_protection: "Modify SL / TP",
  modify_position: "Modify SL / TP", // legacy
  rate_limited: "Rate Limited",
  blocked: "Blocked",
};

export const prettyAuditStatus = (s?: string | null): string =>
  s ? (AUDIT_STATUS_LABELS[s] ?? s) : "—";
export const prettyAuditClassification = (s?: string | null): string =>
  s ? (AUDIT_CLASSIFICATION_LABELS[s] ?? s) : "—";
