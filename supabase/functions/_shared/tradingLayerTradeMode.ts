// Trading Layer trade_mode enum + directional operation gating.
// Source: Trading Layer OpenAPI spec (docs/trading-layer-openapi.json).
//
// Enum values:
//   0 = SYMBOL_TRADE_MODE_DISABLED   — no trading
//   1 = SYMBOL_TRADE_MODE_LONGONLY   — only long positions allowed
//   2 = SYMBOL_TRADE_MODE_SHORTONLY  — only short positions allowed
//   3 = SYMBOL_TRADE_MODE_CLOSEONLY  — only position close operations allowed
//   4 = SYMBOL_TRADE_MODE_FULL       — no trade restrictions

export const TRADE_MODE_DISABLED = 0;
export const TRADE_MODE_LONGONLY = 1;
export const TRADE_MODE_SHORTONLY = 2;
export const TRADE_MODE_CLOSEONLY = 3;
export const TRADE_MODE_FULL = 4;

export const TRADE_MODE_LABELS: Record<number, string> = {
  0: "SYMBOL_TRADE_MODE_DISABLED",
  1: "SYMBOL_TRADE_MODE_LONGONLY",
  2: "SYMBOL_TRADE_MODE_SHORTONLY",
  3: "SYMBOL_TRADE_MODE_CLOSEONLY",
  4: "SYMBOL_TRADE_MODE_FULL",
};

export type TradeModeRaw = number | string | null | undefined;

export interface TradeModeInterpretation {
  raw: number | null;
  label: string | null;
  known: boolean;
}

export function interpretTradeMode(raw: TradeModeRaw): TradeModeInterpretation {
  if (raw == null || raw === "") return { raw: null, label: null, known: false };
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return { raw: null, label: null, known: false };
  const label = TRADE_MODE_LABELS[n] ?? null;
  return { raw: n, label, known: label !== null };
}

const tm = (raw: TradeModeRaw) => interpretTradeMode(raw).raw;

export function canOpenBuy(raw: TradeModeRaw): boolean {
  const n = tm(raw);
  return n === TRADE_MODE_LONGONLY || n === TRADE_MODE_FULL;
}

export function canOpenSell(raw: TradeModeRaw): boolean {
  const n = tm(raw);
  return n === TRADE_MODE_SHORTONLY || n === TRADE_MODE_FULL;
}

export function canClosePosition(raw: TradeModeRaw): boolean {
  const n = tm(raw);
  // DISABLED (0): block. All other known states permit reducing/closing
  // existing exposure. LONGONLY/SHORTONLY do not block the offsetting
  // close of an already-open position.
  return n != null && n !== TRADE_MODE_DISABLED;
}

export function canModifyProtection(raw: TradeModeRaw): boolean {
  const n = tm(raw);
  // SL/TP modification on an existing position is allowed unless the
  // instrument is fully disabled.
  return n != null && n !== TRADE_MODE_DISABLED;
}

export function canPlacePendingBuy(raw: TradeModeRaw): boolean {
  return canOpenBuy(raw);
}

export function canPlacePendingSell(raw: TradeModeRaw): boolean {
  return canOpenSell(raw);
}

export type ExecutionOperation =
  | "market_buy"
  | "market_sell"
  | "pending_buy_limit"
  | "pending_buy_stop"
  | "pending_sell_limit"
  | "pending_sell_stop"
  | "close_position"
  | "modify_protection"
  | "cancel_pending";

export interface DirectionalEligibility {
  allowed: boolean;
  reason: string | null;
}

export function checkOperationEligibility(
  operation: ExecutionOperation,
  symbolTradeMode: TradeModeRaw,
): DirectionalEligibility {
  const info = interpretTradeMode(symbolTradeMode);
  if (!info.known) {
    return { allowed: false, reason: "SYMBOL_TRADE_MODE_UNKNOWN" };
  }
  switch (operation) {
    case "market_buy":
    case "pending_buy_limit":
    case "pending_buy_stop":
      return canOpenBuy(symbolTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "SYMBOL_DIRECTION_BLOCKED_BUY" };
    case "market_sell":
    case "pending_sell_limit":
    case "pending_sell_stop":
      return canOpenSell(symbolTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "SYMBOL_DIRECTION_BLOCKED_SELL" };
    case "close_position":
    case "cancel_pending":
      return canClosePosition(symbolTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "SYMBOL_TRADE_DISABLED" };
    case "modify_protection":
      return canModifyProtection(symbolTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "SYMBOL_TRADE_DISABLED" };
  }
}

export function sideToOperation(
  side: string,
  orderType: string = "market",
): ExecutionOperation {
  const s = String(side || "").toLowerCase();
  const t = String(orderType || "market").toLowerCase();
  if (t === "market" || t === "" || t === "instant") {
    return s === "sell" ? "market_sell" : "market_buy";
  }
  if (t.includes("limit")) {
    return s === "sell" ? "pending_sell_limit" : "pending_buy_limit";
  }
  if (t.includes("stop")) {
    return s === "sell" ? "pending_sell_stop" : "pending_buy_stop";
  }
  return s === "sell" ? "market_sell" : "market_buy";
}

// Account-level directional gating.
// Trading Layer OpenAPI defines Mt5AccountInfo.trade_mode using
// ENUM_SYMBOL_TRADE_MODE — the SAME enum as per-symbol trade_mode.
// 0=DISABLED, 1=LONGONLY, 2=SHORTONLY, 3=CLOSEONLY, 4=FULL.
// `trade_allowed` is a separate boolean account flag.
export function checkAccountOperationEligibility(
  operation: ExecutionOperation,
  accountTradeAllowed: boolean | null | undefined,
  accountTradeMode: TradeModeRaw,
): DirectionalEligibility {
  if (accountTradeAllowed === false) {
    return { allowed: false, reason: "ACCOUNT_TRADE_NOT_ALLOWED" };
  }
  if (accountTradeAllowed == null) {
    return { allowed: false, reason: "ACCOUNT_TRADE_PERMISSION_UNAVAILABLE" };
  }
  const info = interpretTradeMode(accountTradeMode);
  if (!info.known) {
    // No explicit account mode → don't gate at account level, defer to symbol.
    return { allowed: true, reason: null };
  }
  const tail = info.label?.replace("SYMBOL_TRADE_MODE_", "") ?? String(info.raw);
  switch (operation) {
    case "market_buy":
    case "pending_buy_limit":
    case "pending_buy_stop":
      return canOpenBuy(accountTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: `BUY_NOT_ALLOWED_BY_ACCOUNT_TRADE_MODE_${tail}` };
    case "market_sell":
    case "pending_sell_limit":
    case "pending_sell_stop":
      return canOpenSell(accountTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: `SELL_NOT_ALLOWED_BY_ACCOUNT_TRADE_MODE_${tail}` };
    case "close_position":
    case "cancel_pending":
      return canClosePosition(accountTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "ACCOUNT_TRADE_DISABLED" };
    case "modify_protection":
      return canModifyProtection(accountTradeMode)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "ACCOUNT_TRADE_DISABLED" };
  }
}

// Error codes
export const ERR_ACCOUNT_TRADE_NOT_ALLOWED = "ACCOUNT_TRADE_NOT_ALLOWED";
export const ERR_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE =
  "ACCOUNT_TRADE_PERMISSION_UNAVAILABLE";
export const ERR_ACCOUNT_DIRECTION_BLOCKED = "ACCOUNT_DIRECTION_BLOCKED";
export const ERR_SYMBOL_DIRECTION_BLOCKED = "SYMBOL_DIRECTION_BLOCKED";
