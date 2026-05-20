/**
 * Action payload helpers — used by row/card action buttons to resolve
 * complete identifiers before opening modals or calling backend functions.
 *
 * These helpers do NOT change execution, risk, reconciliation, or symbol-source
 * logic. They only normalize how UI buttons look up identifiers on the objects
 * already present in the React tree, and produce clear messages when required
 * fields are missing.
 */

export type AnyObj = Record<string, any> | null | undefined;

/** Return the first non-empty, finite identifier from a trading position. */
export function getPositionIdentifier(position: AnyObj): string | null {
  if (!position) return null;
  const keys = ["positionTicket", "ticket", "positionId", "id", "order", "deal"];
  for (const k of keys) {
    const v = (position as any)[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length > 0 && s !== "null" && s !== "undefined") return s;
  }
  return null;
}

/** Exact broker/MT5 symbol — never normalized for execution actions. */
export function getBrokerSymbol(obj: AnyObj): string | null {
  if (!obj) return null;
  const keys = ["brokerSymbol", "mt5Symbol", "symbolRaw", "symbol"];
  for (const k of keys) {
    const v = (obj as any)[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}

/** Generic identifier resolution for non-trading rows/cards. */
export function getRowIdentifier(row: AnyObj): string | null {
  if (!row) return null;
  const keys = ["id", "uuid", "ticket", "positionId", "orderId", "dealId", "accountId", "slug", "key"];
  for (const k of keys) {
    const v = (row as any)[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return null;
}

/**
 * Validate a close/partial/modify payload before opening the modal or calling
 * the edge function. Returns a user-readable error or null.
 */
export function validatePositionAction(position: AnyObj): string | null {
  if (!position) return "Position data is missing. Refresh positions and try again.";
  if (!getPositionIdentifier(position)) {
    return "Position identifier missing on this row. Refresh positions and try again.";
  }
  if (!getBrokerSymbol(position)) {
    return "Broker symbol missing on this row. Refresh positions and try again.";
  }
  const v = Number((position as any).volume);
  if (!Number.isFinite(v) || v <= 0) {
    return "Position volume is invalid. Refresh positions and try again.";
  }
  return null;
}

/** Sanitized payload diagnostics for Dev Mode modals — never expose secrets. */
export function devDiagnostics(label: string, payload: AnyObj): Record<string, any> {
  return {
    action: label,
    resolvedIdentifier: getPositionIdentifier(payload),
    brokerSymbol: getBrokerSymbol(payload),
    displaySymbol: (payload as any)?.symbol ?? null,
    side: (payload as any)?.side ?? null,
    volume: (payload as any)?.volume ?? null,
    keys: payload ? Object.keys(payload as any) : [],
  };
}
