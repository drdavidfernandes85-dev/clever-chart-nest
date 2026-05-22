// Shared backend enforcement for execution mode + admin live-test allowlist.
//
// execution_mode values (persisted in `site_settings` under key `execution_mode`):
//   - "dry_run"              → reject all live order submissions
//   - "controlled_live_test" → admin-only, mapping must match authorised tester
//   - "admin_live_test"      → admin-only, mapping must match authorised tester
//                              (functionally identical to controlled_live_test
//                               but exposes the full real trading toolset)
//   - "live"                 → any authenticated user with a valid mapping
//
// Authorised tester (single allowlisted account for admin testing):
export const ADMIN_TESTER_TRADER_ID =
  "29008868-d583-4ab5-a6c1-57586fe92007";
export const ADMIN_TESTER_MT5_LOGIN = "87943580";

export const LIVE_EXEC_DISABLED_CODE = "LIVE_EXECUTION_NOT_ENABLED_FOR_USER";

export type ExecutionMode =
  | "dry_run"
  | "controlled_live_test"
  | "admin_live_test"
  | "live";

export async function getExecutionMode(supabase: any): Promise<ExecutionMode> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "execution_mode")
      .maybeSingle();
    const raw = (data?.value as any)?.mode;
    if (
      raw === "dry_run" ||
      raw === "controlled_live_test" ||
      raw === "admin_live_test" ||
      raw === "live"
    ) {
      return raw;
    }
  } catch { /* ignore */ }
  return "controlled_live_test";
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  } catch { return false; }
}

export interface MappingCheckInput {
  traderId?: string | null;
  login?: string | null;
}

export interface ExecutionGateResult {
  allowed: boolean;
  mode: ExecutionMode;
  reason?: string;
  code?: string;
}

/**
 * Authoritative live-execution gate. Call this AFTER the user is authenticated
 * and the active MT mapping has been resolved, BEFORE any order/close/modify
 * call is forwarded to Trading Layer.
 */
export async function assertLiveExecutionAllowed(
  supabase: any,
  userId: string | null,
  mapping: MappingCheckInput,
): Promise<ExecutionGateResult> {
  const mode = await getExecutionMode(supabase);

  if (!userId) {
    return {
      allowed: false,
      mode,
      code: LIVE_EXEC_DISABLED_CODE,
      reason: "Authentication required.",
    };
  }

  if (mode === "dry_run") {
    return {
      allowed: false,
      mode,
      code: LIVE_EXEC_DISABLED_CODE,
      reason: "Execution mode is dry_run — live orders are disabled.",
    };
  }

  if (mode === "live") {
    return { allowed: true, mode };
  }

  // controlled_live_test + admin_live_test → admin allowlist only.
  const admin = await isAdmin(supabase, userId);
  if (!admin) {
    return {
      allowed: false,
      mode,
      code: LIVE_EXEC_DISABLED_CODE,
      reason:
        "Live execution is currently restricted to authorised admin testers.",
    };
  }
  const traderMatch =
    !!mapping.traderId &&
    String(mapping.traderId) === ADMIN_TESTER_TRADER_ID;
  const loginMatch =
    !mapping.login || String(mapping.login) === ADMIN_TESTER_MT5_LOGIN;
  if (!traderMatch || !loginMatch) {
    return {
      allowed: false,
      mode,
      code: LIVE_EXEC_DISABLED_CODE,
      reason:
        "Connected MT5 account is not the authorised admin tester account.",
    };
  }
  return { allowed: true, mode };
}
