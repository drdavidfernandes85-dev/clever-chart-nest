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

// ============================================================
// ACCOUNT-LEVEL trade_mode (ENUM_ACCOUNT_TRADE_MODE) — distinct
// from per-symbol ENUM_SYMBOL_TRADE_MODE. MT5 defines:
//   0 = ACCOUNT_TRADE_MODE_DEMO
//   1 = ACCOUNT_TRADE_MODE_CONTEST
//   2 = ACCOUNT_TRADE_MODE_REAL
// This is INFORMATIONAL ONLY. It is NOT a directional restriction.
// Authoritative live evidence: route 559a12e4… returned trade_mode=2
// AND successfully placed a real BUY EURUSD 0.01 (order 1169085428,
// retcode 10008 TRADE_RETCODE_PLACED). Therefore account.trade_mode=2
// CANNOT mean SHORTONLY. Directional gating MUST come from the exact
// brokerSymbol's symbol.trade_mode only.
// ============================================================
export const ACCOUNT_TRADE_MODE_DEMO = 0;
export const ACCOUNT_TRADE_MODE_CONTEST = 1;
export const ACCOUNT_TRADE_MODE_REAL = 2;
export const ACCOUNT_TRADE_MODE_LABELS: Record<number, string> = {
  0: "ACCOUNT_TRADE_MODE_DEMO",
  1: "ACCOUNT_TRADE_MODE_CONTEST",
  2: "ACCOUNT_TRADE_MODE_REAL",
};
export interface AccountTradeModeInterpretation {
  raw: number | null;
  label: string | null;
  known: boolean;
}
export function interpretAccountTradeMode(raw: TradeModeRaw): AccountTradeModeInterpretation {
  if (raw == null || raw === "") return { raw: null, label: null, known: false };
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return { raw: null, label: null, known: false };
  const label = ACCOUNT_TRADE_MODE_LABELS[n] ?? null;
  return { raw: n, label, known: label !== null };
}

// Account-level eligibility gates ONLY on `trade_allowed`. The MT5
// account.trade_mode enum (DEMO/CONTEST/REAL) is informational and does
// NOT restrict BUY vs SELL. Directional gating must be performed against
// the exact per-symbol trade_mode via checkOperationEligibility().
export function checkAccountOperationEligibility(
  _operation: ExecutionOperation,
  accountTradeAllowed: boolean | null | undefined,
  _accountTradeMode: TradeModeRaw,
): DirectionalEligibility {
  if (accountTradeAllowed === false) {
    return { allowed: false, reason: "ACCOUNT_TRADE_NOT_ALLOWED" };
  }
  if (accountTradeAllowed == null) {
    return { allowed: false, reason: "ACCOUNT_TRADE_PERMISSION_UNAVAILABLE" };
  }
  return { allowed: true, reason: null };
}

// Error codes
export const ERR_ACCOUNT_TRADE_NOT_ALLOWED = "ACCOUNT_TRADE_NOT_ALLOWED";
export const ERR_ACCOUNT_TRADE_PERMISSION_UNAVAILABLE =
  "ACCOUNT_TRADE_PERMISSION_UNAVAILABLE";
export const ERR_ACCOUNT_DIRECTION_BLOCKED = "ACCOUNT_DIRECTION_BLOCKED";
export const ERR_SYMBOL_DIRECTION_BLOCKED = "SYMBOL_DIRECTION_BLOCKED";

// Deployed execution-policy version marker. Bumped after correcting the
// account.trade_mode interpretation (account-level enum is DEMO/CONTEST/
// REAL — informational only; directional gating is per-symbol only).
export const EXECUTION_POLICY_VERSION =
  "TL_ACCOUNT_MODE_INFORMATIONAL_SYMBOL_DIRECTIONAL_V2_2026_05_27";
