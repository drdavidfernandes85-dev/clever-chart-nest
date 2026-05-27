// Account.trade_mode is MT5 ENUM_ACCOUNT_TRADE_MODE (DEMO/CONTEST/REAL).
// It is informational only and MUST NOT restrict BUY vs SELL.
// Directional gating is per-symbol via checkOperationEligibility().
import {
  checkAccountOperationEligibility,
  checkOperationEligibility,
  interpretAccountTradeMode,
  ACCOUNT_TRADE_MODE_REAL,
  ACCOUNT_TRADE_MODE_DEMO,
  TRADE_MODE_FULL,
  TRADE_MODE_DISABLED,
  TRADE_MODE_LONGONLY,
  TRADE_MODE_SHORTONLY,
  TRADE_MODE_CLOSEONLY,
  sideToOperation,
} from "./tradingLayerTradeMode.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Verified live evidence (order 1169085428 placed successfully):
//   account.trade_allowed = true, account.trade_mode = 2 (REAL)
//   symbol EURUSD.trade_mode = FULL → BUY succeeded.

Deno.test("account.trade_mode=2 is REAL, not SHORTONLY — BUY allowed", () => {
  const info = interpretAccountTradeMode(2);
  assertEquals(info.label, "ACCOUNT_TRADE_MODE_REAL");
  const op = sideToOperation("buy", "market");
  const acc = checkAccountOperationEligibility(op, true, 2);
  assertEquals(acc.allowed, true);
});

Deno.test("account.trade_mode=2 — SELL also allowed by account gate", () => {
  const op = sideToOperation("sell", "market");
  const acc = checkAccountOperationEligibility(op, true, 2);
  assertEquals(acc.allowed, true);
});

Deno.test("trade_allowed=false blocks all operations regardless of mode", () => {
  for (const op of ["market_buy", "market_sell", "close_position", "modify_protection"] as const) {
    assertEquals(checkAccountOperationEligibility(op, false, ACCOUNT_TRADE_MODE_REAL).allowed, false);
  }
});

Deno.test("symbol FULL allows BUY and SELL", () => {
  assertEquals(checkOperationEligibility("market_buy", TRADE_MODE_FULL).allowed, true);
  assertEquals(checkOperationEligibility("market_sell", TRADE_MODE_FULL).allowed, true);
});

Deno.test("symbol DISABLED blocks everything", () => {
  assertEquals(checkOperationEligibility("market_buy", TRADE_MODE_DISABLED).allowed, false);
  assertEquals(checkOperationEligibility("close_position", TRADE_MODE_DISABLED).allowed, false);
});

Deno.test("symbol LONGONLY blocks SELL but allows BUY and close", () => {
  assertEquals(checkOperationEligibility("market_buy", TRADE_MODE_LONGONLY).allowed, true);
  assertEquals(checkOperationEligibility("market_sell", TRADE_MODE_LONGONLY).allowed, false);
  assertEquals(checkOperationEligibility("close_position", TRADE_MODE_LONGONLY).allowed, true);
});

Deno.test("symbol SHORTONLY blocks BUY but allows SELL and close", () => {
  assertEquals(checkOperationEligibility("market_sell", TRADE_MODE_SHORTONLY).allowed, true);
  assertEquals(checkOperationEligibility("market_buy", TRADE_MODE_SHORTONLY).allowed, false);
});

Deno.test("symbol CLOSEONLY blocks new opens, allows close", () => {
  assertEquals(checkOperationEligibility("market_buy", TRADE_MODE_CLOSEONLY).allowed, false);
  assertEquals(checkOperationEligibility("close_position", TRADE_MODE_CLOSEONLY).allowed, true);
});
