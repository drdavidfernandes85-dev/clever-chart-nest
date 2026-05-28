// Regression tests for controlled-close route + outcome contract.
// Mirrors the logic enforced in supabase/functions/close-position-controlled/index.ts.
// Run: deno test supabase/functions/_shared/closeRoute_test.ts --allow-net --allow-env

import {
  assertEquals,
  assertStringIncludes,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertCloseRoute,
  buildCloseEndpoint,
  buildCloseDTO,
  classifyCloseOutcome,
  evaluateLifecycleAfterAcceptedClose,
  BASE_URL,
} from "./closeRoute.ts";
import { evaluateCloseAuthority } from "./livePositions.ts";

const VERIFIED_ROUTE = "559a12e4-16d8-4db3-be48-40fbea54bcfe";
const WRONG_ROUTE = "29008868-d583-4ab5-a6c1-57586fe92007"; // traderId, NOT a route
const TICKET = "1169166422";

Deno.test("Scenario 1 — correct verified execution route used for close", () => {
  const guard = assertCloseRoute({
    callerRouteAccountId: VERIFIED_ROUTE,
    mappingRouteAccountId: VERIFIED_ROUTE,
    traderId: WRONG_ROUTE,
  });
  assert(guard.ok, "route guard must pass when caller route matches verified mapping route");
  const url = `${BASE_URL}${buildCloseEndpoint(VERIFIED_ROUTE)}`;
  assertEquals(url, `https://api.trading-layer.com/api/v1/accounts/${VERIFIED_ROUTE}/trades/send`);
  assert(!url.includes(WRONG_ROUTE), "close URL must not contain the wrong/traderId route");
  assertStringIncludes(url, `/accounts/${VERIFIED_ROUTE}/trades/send`);
});

Deno.test("Scenario 2 — wrong route blocked before mutation", () => {
  const guard = assertCloseRoute({
    callerRouteAccountId: WRONG_ROUTE,
    mappingRouteAccountId: VERIFIED_ROUTE,
    traderId: WRONG_ROUTE,
  });
  assert(!guard.ok);
  if (guard.ok) return;
  assertEquals(guard.error, "CLOSE_EXECUTION_ROUTE_MISMATCH");
  assertEquals(guard.brokerCloseMutationDispatched, false);
  assertEquals(guard.expectedRouteAccountId, VERIFIED_ROUTE);
  assertEquals(guard.attemptedRouteAccountId, WRONG_ROUTE);
  // And no fetch is performed because the guard returns before dispatch — this
  // test asserts the contract; the edge function honours it by returning the
  // guard result before calling fetch().
});

Deno.test("Scenario 3 — live position present while local mirror is missing", () => {
  // Live TL lookup contains the exact confirmed ticket; mt_positions does not.
  // The shared livePositions.evaluateCloseAuthority must still authorise close
  // and the route must remain the verified one.
  const livePayload = {
    ok: true,
    httpStatus: 200,
    fetchedAt: new Date().toISOString(),
    source: "trading_layer_live_forced" as const,
    positions: [{
      ticket: TICKET, symbol: "EURUSD", side: "sell", volume: 0.01,
      openPrice: 1.0850, openedAt: new Date().toISOString(),
    }],
    error: null,
  };
  const authority = evaluateCloseAuthority(livePayload as any, {
    requestedTicket: TICKET,
    expectedTicket: TICKET,
    expectedBrokerSymbol: "EURUSD",
    expectedSide: "sell",
    expectedVolume: 0.01,
  });
  assertEquals(authority.code, "LIVE_POSITION_CONFIRMED_FOR_CLOSE");
  // mirror absence is irrelevant — close stays eligible, never ticket_not_live.
  assert(authority.code !== "ticket_not_live" as any);
  const guard = assertCloseRoute({
    callerRouteAccountId: VERIFIED_ROUTE,
    mappingRouteAccountId: VERIFIED_ROUTE,
    traderId: WRONG_ROUTE,
  });
  assert(guard.ok);
});

Deno.test("Scenario 4 — TL close rejection (retcode 10017) propagated truthfully", () => {
  const fixture = {
    data: {
      retcode: 10017,
      retcode_name: "TRADE_RETCODE_TRADE_DISABLED",
      retcode_description: "Trade is disabled",
      classification: "rejected",
      order: 0,
      deal: 0,
    },
  };
  const outcome = classifyCloseOutcome({ httpStatus: 200, response: fixture });
  assertEquals(outcome.classification, "controlled_close_broker_rejected");
  assertEquals(outcome.brokerCloseMutationDispatched, true);
  assertEquals(outcome.retcode, 10017);
  assertEquals(outcome.retcodeName, "TRADE_RETCODE_TRADE_DISABLED");
  assertEquals(outcome.retcodeDescription, "Trade is disabled");
  // never silently report "Close dispatched" success
  assert(outcome.outcome !== "success");
});

Deno.test("Scenario 5 — TL close acceptance does not equal lifecycle PASS", () => {
  // Acceptance fixture: retcode 10009 (TRADE_RETCODE_DONE) — broker accepted.
  const fixture = { data: { retcode: 10009, retcode_name: "TRADE_RETCODE_DONE" } };
  const outcome = classifyCloseOutcome({ httpStatus: 200, response: fixture });
  assertEquals(outcome.outcome, "success");
  // Lifecycle is still awaiting reconciliation until the ticket disappears
  // from live TL positions.
  const lifecycle = evaluateLifecycleAfterAcceptedClose({
    confirmedTicket: TICKET,
    livePositionsAfter: [{ ticket: TICKET }], // still visible — not yet reconciled
  });
  assertEquals(lifecycle.controlledCloseValidationStatus, "awaiting_reconciliation");
  assertEquals(lifecycle.fullLifecycleStatus, "awaiting_close_confirmation");
  assertEquals(lifecycle.residualExposure, "detected");
});

Deno.test("Scenario 6 — live reconciliation confirms closure", () => {
  const lifecycle = evaluateLifecycleAfterAcceptedClose({
    confirmedTicket: TICKET,
    livePositionsAfter: [], // ticket is gone after accepted close
  });
  assertEquals(lifecycle.controlledCloseValidationStatus, "passed");
  assertEquals(lifecycle.fullLifecycleStatus, "passed");
  assertEquals(lifecycle.residualExposure, "none");
  // And the close DTO semantics are preserved (sell-position closed with buy,
  // deviation:20, position ticket included).
  const dto = buildCloseDTO({ openSide: "sell", brokerSymbol: "EURUSD", volume: 0.01, ticket: TICKET });
  assertEquals(dto, { side: "buy", symbol: "EURUSD", volume: 0.01, position: Number(TICKET), deviation: 20 });
});
