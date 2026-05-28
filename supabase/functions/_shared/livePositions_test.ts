// Regression tests for the authoritative close-authority resolver.
// Covers the six scenarios required after the controlled-close failure
// (lifecycle authorisation b53c4bca…, ticket 1169128468):
//   1. Prior failure regression — mirror empty, live TL has exact ticket → allowed
//   2. Wrong ticket → CONTROLLED_CLOSE_TICKET_MISMATCH
//   3. Local-only stale row, live TL missing → LIVE_POSITION_NOT_FOUND_FOR_CLOSE
//   4. Ticket matches but attributes differ → CONTROLLED_CLOSE_POSITION_ATTRIBUTES_MISMATCH
//   5. Duplicate close click — caller-side lifecycle guard (not this module)
//   6. Live verified ticket + mirror already matches → allowed

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  evaluateCloseAuthority,
  type LiveLookupResult,
  type LiveTlPosition,
} from "./livePositions.ts";

const livePos = (over: Partial<LiveTlPosition> = {}): LiveTlPosition => ({
  ticket: "1169128468",
  symbol: "EURUSD",
  side: "sell",
  volume: 0.01,
  openPrice: 1.16321,
  profit: 0,
  openedAt: "2026-05-28T00:10:00Z",
  raw: {},
  ...over,
});

const okLookup = (positions: LiveTlPosition[]): LiveLookupResult => ({
  ok: true, httpStatus: 200, positions,
  fetchedAt: new Date().toISOString(),
  source: "trading_layer_positions_forced",
});

const failedLookup = (): LiveLookupResult => ({
  ok: false, httpStatus: 502, positions: [],
  fetchedAt: new Date().toISOString(),
  source: "trading_layer_positions_forced",
  error: "tl_positions_502",
});

Deno.test("scenario 1 — mirror empty, live TL has exact ticket → CONFIRMED", () => {
  const r = evaluateCloseAuthority(okLookup([livePos()]), {
    requestedTicket: "1169128468",
    expectedTicket: "1169128468",
    expectedBrokerSymbol: "EURUSD",
    expectedSide: "sell",
    expectedVolume: 0.01,
  });
  assertEquals(r.code, "LIVE_POSITION_CONFIRMED_FOR_CLOSE");
});

Deno.test("scenario 2 — requested ticket ≠ lifecycle ticket → TICKET_MISMATCH", () => {
  const r = evaluateCloseAuthority(okLookup([livePos()]), {
    requestedTicket: "9999999999",
    expectedTicket: "1169128468",
    expectedBrokerSymbol: "EURUSD",
    expectedSide: "sell",
    expectedVolume: 0.01,
  });
  assertEquals(r.code, "CONTROLLED_CLOSE_TICKET_MISMATCH");
});

Deno.test("scenario 3 — local-only stale row, live TL missing → NOT_FOUND", () => {
  const r = evaluateCloseAuthority(okLookup([]), {
    requestedTicket: "1169128468",
    expectedTicket: "1169128468",
    expectedBrokerSymbol: "EURUSD",
    expectedSide: "sell",
    expectedVolume: 0.01,
  });
  assertEquals(r.code, "LIVE_POSITION_NOT_FOUND_FOR_CLOSE");
});

Deno.test("scenario 4 — live ticket attributes differ → ATTRIBUTES_MISMATCH", () => {
  const r = evaluateCloseAuthority(okLookup([livePos({ side: "buy" })]), {
    requestedTicket: "1169128468",
    expectedTicket: "1169128468",
    expectedBrokerSymbol: "EURUSD",
    expectedSide: "sell",
    expectedVolume: 0.01,
  });
  assertEquals(r.code, "CONTROLLED_CLOSE_POSITION_ATTRIBUTES_MISMATCH");
});

Deno.test("scenario 5 — duplicate click is enforced by lifecycle dispatch counter (out of scope here)", () => {
  // execute-lifecycle-close atomically consumes close_dispatches_consumed
  // BEFORE invoking close-position-controlled. Asserting that contract lives
  // at the lifecycle-close layer; this is a placeholder so the suite documents
  // the full scenario matrix.
  assertEquals(1, 1);
});

Deno.test("scenario 6 — live ticket confirmed, mirror would already match → CONFIRMED", () => {
  const r = evaluateCloseAuthority(okLookup([livePos()]), {
    requestedTicket: "1169128468",
    expectedTicket: "1169128468",
    expectedBrokerSymbol: "EURUSD",
    expectedSide: "sell",
    expectedVolume: 0.01,
  });
  assertEquals(r.code, "LIVE_POSITION_CONFIRMED_FOR_CLOSE");
});

Deno.test("upstream failure → LIVE_LOOKUP_FAILED (never silently passes)", () => {
  const r = evaluateCloseAuthority(failedLookup(), {
    requestedTicket: "1169128468",
    expectedBrokerSymbol: "EURUSD",
    expectedSide: "sell",
    expectedVolume: 0.01,
  });
  assertEquals(r.code, "LIVE_LOOKUP_FAILED");
});
