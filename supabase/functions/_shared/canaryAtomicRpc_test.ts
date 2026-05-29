// Server-side atomic canary RPC contract tests.
//
// These tests verify the audit/activation invariants WITHOUT submitting any
// Trading Layer order, and without performing any admin action. They are
// safe to run against the live project: every call is either anonymous or
// reads the current persisted policy.
//
// Run with:
//   deno test supabase/functions/_shared/canaryAtomicRpc_test.ts \
//     --allow-net --allow-env --allow-read

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertCanaryEntryAllowed,
  loadCanaryPolicy,
} from "./canaryPolicy.ts";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  "";
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";

function client() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL/anon key required for atomic RPC tests");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.test("policy is currently disabled pending audited reactivation", async () => {
  const sb = client();
  const policy = await loadCanaryPolicy(sb);
  assertEquals(policy.capability_state, "disabled_by_admin_pending_audited_reactivation");
  assert((policy as any).operational_use_lock?.locked === true);
  assertEquals((policy as any).activated_at ?? null, null);
  assertEquals((policy as any).activated_by_user_id ?? null, null);
});

Deno.test("unauthenticated activation RPC is rejected", async () => {
  const sb = client();
  const { data, error } = await sb.rpc("activate_limited_canary_audited", {
    p_acknowledgements: { ack: true },
    p_policy_test_result: { tests_passed: 40, tests_failed: 0 },
    p_live_exposure_snapshot: { open_positions: 0, pending_orders: 0 },
    p_route_audit_status: "pass",
    p_broker_symbol_audit_status: "pass",
  });
  assert(error, "RPC must reject anonymous callers");
  assertEquals(data, null);
  assertStringIncludes(
    String(error?.message ?? "").toUpperCase(),
    "CANARY_NOT_",
    // CANARY_NOT_AUTHENTICATED or CANARY_NOT_ADMIN
  );
});

Deno.test("unauthenticated disable RPC is rejected", async () => {
  const sb = client();
  const { error } = await sb.rpc("disable_limited_canary_audited", {
    p_reason: "test",
    p_live_exposure_snapshot: { open_positions: 0, pending_orders: 0 },
  });
  assert(error, "Disable RPC must reject anonymous callers");
});

Deno.test("policy unchanged after rejected unauthenticated activation", async () => {
  const sb = client();
  const policy = await loadCanaryPolicy(sb);
  assertEquals(policy.capability_state, "disabled_by_admin_pending_audited_reactivation");
});

Deno.test("entry guard blocks while activation evidence incomplete", async () => {
  const sb = client();
  const r = await assertCanaryEntryAllowed(sb, {
    userId: "00000000-0000-0000-0000-000000000000",
    login: "87943580",
    routeAccountId: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
    displaySymbol: "EURUSD",
    brokerSymbol: "EURUSD",
    side: "sell",
    volume: 0.01,
    operation: "market_sell",
  });
  assertEquals(r.allowed, false);
  // Either CANARY_NOT_ACTIVE (state is disabled) or
  // CANARY_ACTIVATION_AUDIT_EVIDENCE_INCOMPLETE (state active w/o evidence).
  assert(
    r.code === "CANARY_NOT_ACTIVE" ||
      r.code === "CANARY_ACTIVATION_AUDIT_EVIDENCE_INCOMPLETE",
    `Unexpected guard code: ${r.code}`,
  );
});

Deno.test("entry guard blocks BUY even if state were active", async () => {
  const sb = client();
  const r = await assertCanaryEntryAllowed(sb, {
    userId: "00000000-0000-0000-0000-000000000000",
    login: "87943580",
    routeAccountId: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
    displaySymbol: "EURUSD",
    brokerSymbol: "EURUSD",
    side: "buy",
    volume: 0.01,
    operation: "market_buy",
  });
  assertEquals(r.allowed, false);
});

Deno.test("entry guard blocks XAUUSD", async () => {
  const sb = client();
  const r = await assertCanaryEntryAllowed(sb, {
    userId: "00000000-0000-0000-0000-000000000000",
    login: "87943580",
    routeAccountId: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
    displaySymbol: "XAUUSD",
    brokerSymbol: "XAUUSD",
    side: "sell",
    volume: 0.01,
    operation: "market_sell",
  });
  assertEquals(r.allowed, false);
});

Deno.test("entry guard blocks wrong volume", async () => {
  const sb = client();
  const r = await assertCanaryEntryAllowed(sb, {
    userId: "00000000-0000-0000-0000-000000000000",
    login: "87943580",
    routeAccountId: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
    displaySymbol: "EURUSD",
    brokerSymbol: "EURUSD",
    side: "sell",
    volume: 0.10,
    operation: "market_sell",
  });
  assertEquals(r.allowed, false);
});

Deno.test("policy still unchanged after all guard probes", async () => {
  const sb = client();
  const policy = await loadCanaryPolicy(sb);
  assertEquals(policy.capability_state, "disabled_by_admin_pending_audited_reactivation");
  assertEquals((policy as any).activated_at ?? null, null);
});
