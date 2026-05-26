// Static test matrix — Part 4 of position-management safety fix.
// Proves that directional gates apply ONLY to entry intents, and that
// close/cancel/modify are never blocked by SHORTONLY/LONGONLY/CLOSEONLY.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  checkAccountOperationEligibility,
  checkOperationEligibility,
  sideToOperation,
  TRADE_MODE_CLOSEONLY,
  TRADE_MODE_FULL,
  TRADE_MODE_SHORTONLY,
  TRADE_MODE_LONGONLY,
  TRADE_MODE_DISABLED,
} from "./tradingLayerTradeMode.ts";

// Verified live account: trade_allowed=true, trade_mode=SHORTONLY(2).
// EURUSD symbol trade_mode=FULL(4).
const ACC_TA = true;
const ACC = TRADE_MODE_SHORTONLY;
const SYM_FULL = TRADE_MODE_FULL;

Deno.test("Scenario 1 — new BUY blocked under SHORTONLY account", () => {
  const op = sideToOperation("buy", "market");
  const acc = checkAccountOperationEligibility(op, ACC_TA, ACC);
  assertEquals(acc.allowed, false);
  assertEquals(acc.reason, "BUY_NOT_ALLOWED_BY_ACCOUNT_TRADE_MODE_SHORTONLY");
});

Deno.test("Scenario 2 — new SELL eligible under SHORTONLY account + FULL symbol", () => {
  const op = sideToOperation("sell", "market");
  assertEquals(checkAccountOperationEligibility(op, ACC_TA, ACC).allowed, true);
  assertEquals(checkOperationEligibility(op, SYM_FULL).allowed, true);
});

Deno.test("Scenario 3 — CLOSE existing SELL position NOT blocked as OPEN_LONG", () => {
  // Closing a SELL requires a BUY-side deal at MT5, but the operation intent
  // is close_position. Account SHORTONLY must NOT reject it.
  const acc = checkAccountOperationEligibility("close_position", ACC_TA, ACC);
  const sym = checkOperationEligibility("close_position", SYM_FULL);
  assertEquals(acc.allowed, true);
  assertEquals(sym.allowed, true);
});

Deno.test("Scenario 4 — PARTIAL close (close_position intent) NOT blocked", () => {
  assertEquals(
    checkAccountOperationEligibility("close_position", ACC_TA, ACC).allowed,
    true,
  );
});

Deno.test("Scenario 5 — Modify SL/TP NOT blocked by entry-direction gates", () => {
  assertEquals(
    checkAccountOperationEligibility("modify_protection", ACC_TA, ACC).allowed,
    true,
  );
  assertEquals(
    checkOperationEligibility("modify_protection", SYM_FULL).allowed,
    true,
  );
});

Deno.test("Scenario 6 — Cancel pending NOT blocked by entry-direction gates", () => {
  assertEquals(
    checkAccountOperationEligibility("cancel_pending", ACC_TA, ACC).allowed,
    true,
  );
  assertEquals(
    checkOperationEligibility("cancel_pending", SYM_FULL).allowed,
    true,
  );
});

Deno.test("Scenario 7 — CLOSEONLY blocks new opens, allows close", () => {
  assertEquals(
    checkAccountOperationEligibility("market_buy", ACC_TA, TRADE_MODE_CLOSEONLY).allowed,
    false,
  );
  assertEquals(
    checkAccountOperationEligibility("market_sell", ACC_TA, TRADE_MODE_CLOSEONLY).allowed,
    false,
  );
  assertEquals(
    checkAccountOperationEligibility("close_position", ACC_TA, TRADE_MODE_CLOSEONLY).allowed,
    true,
  );
  assertEquals(
    checkOperationEligibility("close_position", TRADE_MODE_CLOSEONLY).allowed,
    true,
  );
});

Deno.test("DISABLED blocks everything including close", () => {
  assertEquals(
    checkAccountOperationEligibility("close_position", ACC_TA, TRADE_MODE_DISABLED).allowed,
    false,
  );
  assertEquals(
    checkOperationEligibility("close_position", TRADE_MODE_DISABLED).allowed,
    false,
  );
});

Deno.test("LONGONLY symmetry — SELL blocked, BUY allowed, close allowed", () => {
  assertEquals(
    checkAccountOperationEligibility("market_sell", ACC_TA, TRADE_MODE_LONGONLY).allowed,
    false,
  );
  assertEquals(
    checkAccountOperationEligibility("market_buy", ACC_TA, TRADE_MODE_LONGONLY).allowed,
    true,
  );
  assertEquals(
    checkAccountOperationEligibility("close_position", ACC_TA, TRADE_MODE_LONGONLY).allowed,
    true,
  );
});

Deno.test("trade_allowed=false blocks every intent (including close)", () => {
  for (const op of ["market_buy","market_sell","close_position","cancel_pending","modify_protection"] as const) {
    assertEquals(
      checkAccountOperationEligibility(op, false, TRADE_MODE_FULL).allowed,
      false,
    );
  }
});

Deno.test("sideToOperation maps pending order types correctly", () => {
  assertEquals(sideToOperation("buy", "limit"), "pending_buy_limit");
  assertEquals(sideToOperation("sell", "stop"), "pending_sell_stop");
  assertEquals(sideToOperation("buy", "market"), "market_buy");
});
