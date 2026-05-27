// Server-side reader for the global final-activation blocker stored in
// `site_settings.final_activation_blocker`. When `active` is true, all
// platform-initiated mutations (execute-trade, submit-best-execution-order,
// submit-pending-order) MUST refuse to dispatch. The only path permitted
// to mutate while the blocker is active is `submit-controlled-retest`,
// which itself consumes a one-shot `controlled_retest_authorisations` row.

export const FINAL_ACTIVATION_BLOCKED_CODE = "FINAL_ACTIVATION_BLOCKER_ACTIVE";

export interface FinalActivationBlocker {
  active: boolean;
  status: string | null;
  blockReasonCode: string | null;
  displayCopy: string | null;
  permittedRetest: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
}

export async function getFinalActivationBlocker(
  supabase: any,
): Promise<FinalActivationBlocker> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "final_activation_blocker")
      .maybeSingle();
    const v = (data?.value ?? null) as Record<string, unknown> | null;
    if (!v) return empty();
    return {
      active: v.active === true,
      status: (v.status as string) ?? null,
      blockReasonCode: (v.block_reason_code as string) ?? null,
      displayCopy: (v.display_copy as string) ?? null,
      permittedRetest: (v.permitted_retest as Record<string, unknown>) ?? null,
      raw: v,
    };
  } catch {
    return empty();
  }
}

function empty(): FinalActivationBlocker {
  return {
    active: false,
    status: null,
    blockReasonCode: null,
    displayCopy: null,
    permittedRetest: null,
    raw: null,
  };
}

export function blockerResponseBody(blocker: FinalActivationBlocker) {
  return {
    success: false,
    step: "final_activation_blocker",
    error: FINAL_ACTIVATION_BLOCKED_CODE,
    blockReasonCode: blocker.blockReasonCode,
    status: blocker.status,
    displayCopy: blocker.displayCopy,
    permittedRetest: blocker.permittedRetest,
    liveOrderSent: false,
    liveOrderAttempted: false,
  };
}
