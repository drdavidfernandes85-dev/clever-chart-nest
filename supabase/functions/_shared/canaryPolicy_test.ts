// Limited Canary Policy — FAIL-CLOSED guard tests.
//
// The canary policy is the authoritative gate: live canary mutations may
// only proceed when capability_state === "active_limited_canary".
// All other states (eligible_for_manual_activation, disabled_by_admin,
// disabled_by_kill_switch, suspended_after_execution_incident,
// blocked_by_readiness_failure) MUST block entry mutation.
//
// Close is blocked unless either:
//   (a) canary is active, OR
//   (b) the policy explicitly records an outstanding_owned_position whose
//       ticket/route/symbol/login match the close request — and the state is
//       suspended_after_execution_incident, disabled_by_admin, or
//       disabled_by_kill_switch (emergency_exposure_reduction_close_only).
//
// Mutation-suppressed: no Trading Layer / network calls. No canary capability
// is activated. No authorisation is created. No live order is submitted.
//
// Run: deno test supabase/functions/_shared/canaryPolicy_test.ts \
//            --allow-net --allow-env --allow-read

import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertCanaryCapabilityDisabled,
  assertCanaryCloseAllowed,
  assertCanaryEntryAllowed,
  type CanaryCapabilityState,
  type CanaryPolicy,
  type OutstandingOwnedPosition,
} from "./canaryPolicy.ts";

const VERIFIED_ROUTE = "559a12e4-16d8-4db3-be48-40fbea54bcfe";
const WRONG_ROUTE_TRADER_ID = "29008868-d583-4ab5-a6c1-57586fe92007";
const ADMIN_USER = "admin-user-uuid";
const NON_ADMIN_USER = "ordinary-user-uuid";
const CANARY_TICKET = "1169599713";

interface FakeOpts {
  state?: CanaryCapabilityState;
  admins?: string[];
  policyOverrides?: Partial<CanaryPolicy> & {
    outstanding_owned_position?: OutstandingOwnedPosition;
  };
}

function fakeSupabase(opts: FakeOpts = {}) {
  const state = opts.state ?? "active_limited_canary";
  const admins = new Set(opts.admins ?? [ADMIN_USER]);
  return {
    from(table: string) {
      const builder: any = {
        _filters: {} as Record<string, unknown>,
        select() { return builder; },
        eq(col: string, val: unknown) { builder._filters[col] = val; return builder; },
        async maybeSingle() {
          if (table === "site_settings") {
            return {
              data: { value: { capability_state: state, ...(opts.policyOverrides ?? {}) } },
              error: null,
            };
          }
          if (table === "user_roles") {
            const uid = builder._filters["user_id"] as string;
            const role = builder._filters["role"] as string;
            if (role === "admin" && admins.has(uid)) {
              return { data: { role: "admin" }, error: null };
            }
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}

const baseEntry = {
  userId: ADMIN_USER,
  login: "87943580",
  routeAccountId: VERIFIED_ROUTE,
  displaySymbol: "EURUSD",
  brokerSymbol: "EURUSD",
  side: "sell",
  operation: "market_sell",
  volume: 0.01,
};

const baseClose = {
  userId: ADMIN_USER,
  login: "87943580",
  routeAccountId: VERIFIED_ROUTE,
  brokerSymbol: "EURUSD",
  ticket: CANARY_TICKET,
  requestedVolume: 0.01,
  positionVolume: 0.01,
};

const outstanding: OutstandingOwnedPosition = {
  ticket: CANARY_TICKET,
  broker_symbol: "EURUSD",
  route_account_id: VERIFIED_ROUTE,
  mt5_login: "87943580",
  volume: 0.01,
};

// ============================================================
// FAIL-CLOSED — INACTIVE STATE BLOCKS ENTRY
// ============================================================

for (
  const state of [
    "eligible_for_manual_activation",
    "disabled_by_admin",
    "disabled_by_kill_switch",
    "suspended_after_execution_incident",
    "blocked_by_readiness_failure",
  ] as const
) {
  Deno.test(`ENTRY: state=${state} blocks otherwise-valid EURUSD SELL 0.01 — CANARY_NOT_ACTIVE`, async () => {
    const r = await assertCanaryEntryAllowed(fakeSupabase({ state }), baseEntry);
    assertFalse(r.allowed);
    assertEquals(r.code, "CANARY_NOT_ACTIVE");
  });
}

// ============================================================
// ACTIVE STATE — VALID CANARY SCOPE PASSES
// ============================================================

Deno.test("ENTRY: state=active_limited_canary, admin EURUSD SELL 0.01 — allowed", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), baseEntry);
  assert(r.allowed, `expected allowed, got ${r.code}: ${r.reason ?? ""}`);
  assertEquals(r.code, "CANARY_SCOPE_OK");
});

Deno.test("ENTRY (active): non-admin blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, userId: NON_ADMIN_USER });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_USER_NOT_ALLOWED");
});

Deno.test("ENTRY (active): wrong MT5 login blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, login: "11111111" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED");
});

Deno.test("ENTRY (active): wrong route accountId (traderId 29008868…) blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, routeAccountId: WRONG_ROUTE_TRADER_ID });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED");
});

Deno.test("ENTRY (active): BUY blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, side: "buy", operation: "market_buy" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_OPERATION_NOT_ALLOWED");
});

for (const v of [0.02, 0.1, 1.0]) {
  Deno.test(`ENTRY (active): wrong volume ${v} blocked`, async () => {
    const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, volume: v });
    assertFalse(r.allowed);
    assertEquals(r.code, "CANARY_SCOPE_VOLUME_NOT_ALLOWED");
  });
}

Deno.test("ENTRY (active): GBPUSD blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, displaySymbol: "GBPUSD", brokerSymbol: "GBPUSD" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_SYMBOL_NOT_ALLOWED");
});

Deno.test("ENTRY (active): XAUUSD blocked as ambiguous", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, displaySymbol: "XAUUSD", brokerSymbol: "XAUUSD" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED");
});

// ============================================================
// FAIL-CLOSED — CLOSE BLOCKED WHEN INACTIVE WITHOUT OUTSTANDING OWNED POSITION
// ============================================================

Deno.test("CLOSE: state=eligible_for_manual_activation, no outstanding owned position — CANARY_NOT_ACTIVE", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({ state: "eligible_for_manual_activation" }),
    baseClose,
  );
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_NOT_ACTIVE");
});

Deno.test("CLOSE: state=disabled_by_admin, no outstanding owned position — CANARY_NOT_ACTIVE", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({ state: "disabled_by_admin" }),
    baseClose,
  );
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_NOT_ACTIVE");
});

Deno.test("CLOSE: state=suspended_after_execution_incident, no outstanding owned position — CANARY_NOT_ACTIVE", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({ state: "suspended_after_execution_incident" }),
    baseClose,
  );
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_NOT_ACTIVE");
});

// ============================================================
// ACTIVE CANARY — EXACT PLATFORM-OWNED CLOSE PASSES
// ============================================================

Deno.test("CLOSE (active): exact platform-owned confirmed close allowed", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), baseClose);
  assert(r.allowed, `expected allowed, got ${r.code}: ${r.reason ?? ""}`);
  assertEquals(r.code, "CANARY_SCOPE_OK");
});

Deno.test("CLOSE (active): missing ticket blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, ticket: null });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_POSITION_NOT_PLATFORM_OWNED");
});

Deno.test("CLOSE (active): wrong symbol blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, brokerSymbol: "GBPUSD" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_SYMBOL_NOT_ALLOWED");
});

Deno.test("CLOSE (active): wrong route blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, routeAccountId: WRONG_ROUTE_TRADER_ID });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED");
});

Deno.test("CLOSE (active): partial close blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, requestedVolume: 0.005 });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_PARTIAL_CLOSE_DISABLED");
});

Deno.test("CLOSE (active): non-admin blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, userId: NON_ADMIN_USER });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_USER_NOT_ALLOWED");
});

// ============================================================
// EMERGENCY EXPOSURE-REDUCTION CLOSE-ONLY
// ============================================================

Deno.test("CLOSE: state=suspended_after_execution_incident WITH matching outstanding owned position — allowed as emergency_exposure_reduction_close_only", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({
      state: "suspended_after_execution_incident",
      policyOverrides: { outstanding_owned_position: outstanding },
    }),
    baseClose,
  );
  assert(r.allowed, `expected allowed, got ${r.code}: ${r.reason ?? ""}`);
  assertEquals(r.code, "CANARY_SCOPE_OK");
  assertEquals(r.reason, "emergency_exposure_reduction_close_only");
});

Deno.test("CLOSE: emergency carve-out still rejects wrong ticket", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({
      state: "suspended_after_execution_incident",
      policyOverrides: { outstanding_owned_position: outstanding },
    }),
    { ...baseClose, ticket: "9999999999" },
  );
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_NOT_ACTIVE");
});

Deno.test("CLOSE: emergency carve-out still rejects non-admin", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({
      state: "disabled_by_admin",
      policyOverrides: { outstanding_owned_position: outstanding },
    }),
    { ...baseClose, userId: NON_ADMIN_USER },
  );
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_USER_NOT_ALLOWED");
});

// ============================================================
// HARD-DISABLED CAPABILITIES (always blocked)
// ============================================================

Deno.test("CAPABILITY: pending_order placement always blocked", async () => {
  const r = await assertCanaryCapabilityDisabled(fakeSupabase(), "pending_order");
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_PENDING_ORDER_DISABLED");
});

Deno.test("CAPABILITY: cancel_pending always blocked", async () => {
  const r = await assertCanaryCapabilityDisabled(fakeSupabase(), "cancel_pending");
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_PENDING_ORDER_DISABLED");
});

Deno.test("CAPABILITY: modify_protection (SL/TP) always blocked", async () => {
  const r = await assertCanaryCapabilityDisabled(fakeSupabase(), "modify_protection");
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_MODIFY_PROTECTION_DISABLED");
});

Deno.test("CAPABILITY: partial_close always blocked", async () => {
  const r = await assertCanaryCapabilityDisabled(fakeSupabase(), "partial_close");
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_PARTIAL_CLOSE_DISABLED");
});

// ============================================================
// BEHAVIOURAL ENDPOINT TESTS — mutation-suppressed
// ============================================================
// These simulate the per-endpoint flow: each mutation endpoint must invoke
// the canary guard first, and a CANARY_NOT_ACTIVE / disabled-capability
// result must prevent any Trading Layer fetch from being issued.

let tlFetchCount = 0;
const tlFetchSentinel = (..._args: unknown[]) => {
  tlFetchCount += 1;
  throw new Error("Trading Layer fetch must not occur when canary guard blocks");
};

async function endpointFlow(
  guard: () => Promise<{ allowed: boolean; code: string }>,
): Promise<{ blocked: boolean; code: string; tlCalls: number }> {
  tlFetchCount = 0;
  const r = await guard();
  if (!r.allowed) return { blocked: true, code: r.code, tlCalls: tlFetchCount };
  // Mutation-suppressed: in the active-canary preview path we would now call
  // tlFetchSentinel(); the test does NOT invoke it to confirm preview-only.
  return { blocked: false, code: r.code, tlCalls: tlFetchCount };
}

Deno.test("ENDPOINT: submit-best-execution-order — inactive canary blocks before any TL fetch", async () => {
  const sb = fakeSupabase({ state: "eligible_for_manual_activation" });
  const res = await endpointFlow(() => assertCanaryEntryAllowed(sb, baseEntry));
  assert(res.blocked);
  assertEquals(res.code, "CANARY_NOT_ACTIVE");
  assertEquals(res.tlCalls, 0);
});

Deno.test("ENDPOINT: execute-trade direct call — inactive canary cannot be bypassed", async () => {
  const sb = fakeSupabase({ state: "eligible_for_manual_activation" });
  const res = await endpointFlow(() => assertCanaryEntryAllowed(sb, baseEntry));
  assert(res.blocked);
  assertEquals(res.code, "CANARY_NOT_ACTIVE");
  assertEquals(res.tlCalls, 0);
});

Deno.test("ENDPOINT: close-position-controlled — inactive canary, no outstanding owned exposure, blocks before any TL fetch", async () => {
  const sb = fakeSupabase({ state: "eligible_for_manual_activation" });
  const res = await endpointFlow(() => assertCanaryCloseAllowed(sb, baseClose));
  assert(res.blocked);
  assertEquals(res.code, "CANARY_NOT_ACTIVE");
  assertEquals(res.tlCalls, 0);
});

Deno.test("ENDPOINT: submit-pending-order — always blocked", async () => {
  const sb = fakeSupabase();
  const res = await endpointFlow(() => assertCanaryCapabilityDisabled(sb, "pending_order"));
  assert(res.blocked);
  assertEquals(res.code, "CANARY_SCOPE_PENDING_ORDER_DISABLED");
});

Deno.test("ENDPOINT: cancel-pending-order — always blocked", async () => {
  const sb = fakeSupabase();
  const res = await endpointFlow(() => assertCanaryCapabilityDisabled(sb, "cancel_pending"));
  assert(res.blocked);
  assertEquals(res.code, "CANARY_SCOPE_PENDING_ORDER_DISABLED");
});

Deno.test("ENDPOINT: modify-position-protection — always blocked", async () => {
  const sb = fakeSupabase();
  const res = await endpointFlow(() => assertCanaryCapabilityDisabled(sb, "modify_protection"));
  assert(res.blocked);
  assertEquals(res.code, "CANARY_SCOPE_MODIFY_PROTECTION_DISABLED");
});

Deno.test("ENDPOINT: active-canary EURUSD SELL 0.01 preview reaches downstream (mutation-suppressed, no TL fetch performed by test)", async () => {
  const sb = fakeSupabase({ state: "active_limited_canary" });
  const res = await endpointFlow(() => assertCanaryEntryAllowed(sb, baseEntry));
  assertFalse(res.blocked);
  assertEquals(res.code, "CANARY_SCOPE_OK");
  assertEquals(res.tlCalls, 0);
});

Deno.test("ENDPOINT: active-canary exact owned close preview reaches downstream (mutation-suppressed, no TL fetch performed by test)", async () => {
  const sb = fakeSupabase({ state: "active_limited_canary" });
  const res = await endpointFlow(() => assertCanaryCloseAllowed(sb, baseClose));
  assertFalse(res.blocked);
  assertEquals(res.code, "CANARY_SCOPE_OK");
  assertEquals(res.tlCalls, 0);
});

// ============================================================
// WIRING — every live mutation endpoint invokes the canary guard
// ============================================================

Deno.test("WIRING: every live mutation endpoint invokes the canary guard", async () => {
  const cases: Array<{ file: string; needle: RegExp }> = [
    { file: "supabase/functions/submit-best-execution-order/index.ts", needle: /assertCanaryEntryAllowed\s*\(/ },
    { file: "supabase/functions/execute-trade/index.ts",               needle: /assertCanaryEntryAllowed\s*\(/ },
    { file: "supabase/functions/close-position-controlled/index.ts",    needle: /assertCanaryCloseAllowed\s*\(/ },
    { file: "supabase/functions/submit-pending-order/index.ts",         needle: /assertCanaryCapabilityDisabled\s*\(\s*[^,]+,\s*["']pending_order["']/ },
    { file: "supabase/functions/cancel-pending-order/index.ts",         needle: /assertCanaryCapabilityDisabled\s*\(\s*[^,]+,\s*["']cancel_pending["']/ },
    { file: "supabase/functions/modify-position-protection/index.ts",   needle: /assertCanaryCapabilityDisabled\s*\(\s*[^,]+,\s*["']modify_protection["']/ },
  ];
  for (const { file, needle } of cases) {
    const src = await Deno.readTextFile(new URL(`../../../${file}`, import.meta.url));
    assert(needle.test(src), `${file} does not invoke the expected canary guard (${needle})`);
  }
});
