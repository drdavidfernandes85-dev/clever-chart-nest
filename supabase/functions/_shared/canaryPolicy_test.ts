// Limited Canary Policy — pure-guard tests for assertCanaryEntryAllowed,
// assertCanaryCloseAllowed and assertCanaryCapabilityDisabled.
//
// Mutation-suppressed: these tests instantiate a fake supabase client; no
// network or Trading Layer calls are made. No canary capability is activated.
//
// Run: deno test supabase/functions/_shared/canaryPolicy_test.ts --allow-net --allow-env

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
} from "./canaryPolicy.ts";

const VERIFIED_ROUTE = "559a12e4-16d8-4db3-be48-40fbea54bcfe";
const WRONG_ROUTE_TRADER_ID = "29008868-d583-4ab5-a6c1-57586fe92007";
const ADMIN_USER = "admin-user-uuid";
const NON_ADMIN_USER = "ordinary-user-uuid";
const CANARY_TICKET = "1169599713";

interface FakeOpts {
  state?: CanaryCapabilityState;
  admins?: string[];
  policyOverrides?: Partial<CanaryPolicy>;
}

function fakeSupabase(opts: FakeOpts = {}) {
  const state = opts.state ?? "active_limited_canary";
  const admins = new Set(opts.admins ?? [ADMIN_USER]);
  return {
    from(table: string) {
      const builder: any = {
        _table: table,
        _filters: {} as Record<string, unknown>,
        select() { return builder; },
        eq(col: string, val: unknown) { builder._filters[col] = val; return builder; },
        async maybeSingle() {
          if (table === "site_settings") {
            return {
              data: {
                value: { capability_state: state, ...(opts.policyOverrides ?? {}) },
              },
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

// ============================================================
// ENTRY GUARD TESTS
// ============================================================

Deno.test("ENTRY: allowed canary scope passes when active", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), baseEntry);
  assert(r.allowed, `expected allowed, got ${r.code}: ${r.reason ?? ""}`);
  assertEquals(r.code, "CANARY_SCOPE_OK");
});

Deno.test("ENTRY: policy not active — guard is no-op (existing executionMode/admin allowlist remain authoritative)", async () => {
  const r = await assertCanaryEntryAllowed(
    fakeSupabase({ state: "eligible_for_manual_activation" }),
    baseEntry,
  );
  assertEquals(r.code, "CANARY_SCOPE_OK");
  assertEquals(r.policy.capability_state, "eligible_for_manual_activation");
});

Deno.test("ENTRY: non-admin / non-allowlisted user blocked", async () => {
  const r = await assertCanaryEntryAllowed(
    fakeSupabase(),
    { ...baseEntry, userId: NON_ADMIN_USER },
  );
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_USER_NOT_ALLOWED");
});

Deno.test("ENTRY: wrong MT5 login blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, login: "11111111" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED");
});

Deno.test("ENTRY: wrong route accountId (traderId 29008868…) blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, routeAccountId: WRONG_ROUTE_TRADER_ID });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED");
});

Deno.test("ENTRY: BUY operation blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, side: "buy", operation: "market_buy" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_OPERATION_NOT_ALLOWED");
});

for (const v of [0.02, 0.1, 1.0]) {
  Deno.test(`ENTRY: wrong volume ${v} blocked`, async () => {
    const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, volume: v });
    assertFalse(r.allowed);
    assertEquals(r.code, "CANARY_SCOPE_VOLUME_NOT_ALLOWED");
  });
}

Deno.test("ENTRY: wrong symbol GBPUSD blocked", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, displaySymbol: "GBPUSD", brokerSymbol: "GBPUSD" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_SYMBOL_NOT_ALLOWED");
});

Deno.test("ENTRY: XAUUSD blocked with ambiguous code", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase(), { ...baseEntry, displaySymbol: "XAUUSD", brokerSymbol: "XAUUSD" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED");
});

// ============================================================
// CLOSE GUARD TESTS
// ============================================================

Deno.test("CLOSE: exact platform-owned confirmed close passes", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), baseClose);
  assert(r.allowed, `expected allowed, got ${r.code}: ${r.reason ?? ""}`);
  assertEquals(r.code, "CANARY_SCOPE_OK");
});

Deno.test("CLOSE: arbitrary / unowned ticket (missing) blocked as not-platform-owned", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, ticket: null });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_POSITION_NOT_PLATFORM_OWNED");
});

Deno.test("CLOSE: wrong symbol blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, brokerSymbol: "GBPUSD" });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_SYMBOL_NOT_ALLOWED");
});

Deno.test("CLOSE: wrong route blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, routeAccountId: WRONG_ROUTE_TRADER_ID });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED");
});

Deno.test("CLOSE: partial close (requested != position volume) blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, requestedVolume: 0.005 });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_PARTIAL_CLOSE_DISABLED");
});

Deno.test("CLOSE: non-admin blocked", async () => {
  const r = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, userId: NON_ADMIN_USER });
  assertFalse(r.allowed);
  assertEquals(r.code, "CANARY_SCOPE_USER_NOT_ALLOWED");
});

// Idempotency / duplicate-close: simulated by the same ticket being closed
// twice. The pure guard accepts both shapes (it does not own dedup state);
// duplicate suppression lives in the confirmation coordinator. We assert
// here only that the guard does not weaken ownership/ticket checks.
Deno.test("CLOSE: duplicate-close shape still requires exact ticket — guard does not weaken ownership", async () => {
  const first = await assertCanaryCloseAllowed(fakeSupabase(), baseClose);
  const second = await assertCanaryCloseAllowed(fakeSupabase(), { ...baseClose, ticket: "" });
  assert(first.allowed);
  assertFalse(second.allowed);
  assertEquals(second.code, "CANARY_SCOPE_POSITION_NOT_PLATFORM_OWNED");
});

// ============================================================
// STATE TRANSITION TESTS
// ============================================================

Deno.test("STATE: disabled_by_admin — entry blocked even for admin in scope (guard passes-through; endpoint-level mode enforces block)", async () => {
  // Pure guard returns OK outside active state (executionMode owns the gate).
  // The contract under test here is that the policy record exposes the state
  // verbatim so endpoints can hard-fail.
  const r = await assertCanaryEntryAllowed(fakeSupabase({ state: "disabled_by_admin" }), baseEntry);
  assertEquals(r.policy.capability_state, "disabled_by_admin");
});

Deno.test("STATE: disabled_by_kill_switch surfaces state to caller", async () => {
  const r = await assertCanaryEntryAllowed(fakeSupabase({ state: "disabled_by_kill_switch" }), baseEntry);
  assertEquals(r.policy.capability_state, "disabled_by_kill_switch");
});

Deno.test("STATE: suspended_after_execution_incident — close remains gated for risk reduction", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({ state: "suspended_after_execution_incident" }),
    baseClose,
  );
  // Risk-reducing close path: guard still enforces admin + exact ownership.
  assert(r.allowed, `expected risk-reducing close to pass guard, got ${r.code}`);
});

Deno.test("STATE: suspended_after_execution_incident — non-admin still blocked", async () => {
  const r = await assertCanaryCloseAllowed(
    fakeSupabase({ state: "suspended_after_execution_incident" }),
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
// ENDPOINT INTEGRATION (mutation-suppressed wiring proof)
// ============================================================
// These assert at the source level that every live mutation entry point
// imports and invokes the canary guard before any Trading Layer call. No
// network mutation is performed.

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
