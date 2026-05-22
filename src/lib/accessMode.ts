/**
 * Review/testing access mode.
 *
 * This temporarily bypasses the $100 USD minimum net balance gate for
 * Compliance reviewers, internal testers, and selected users. Re-enable
 * the balance requirement before production rollout if required by
 * business / compliance by setting VITE_REVIEW_ACCESS_MODE=false (or
 * removing the env var and flipping REVIEW_ACCESS_MODE_DEFAULT below).
 *
 * IMPORTANT — what this flag does NOT do:
 *   - It does NOT bypass MT5 connection requirements where a feature needs one.
 *   - It does NOT disable risk controls, kill switch, testing-mode volume
 *     limits, confirmation prompts, or any server-side risk validation.
 *   - It does NOT allow unsafe live trading. All execution safety stays on.
 *
 * It ONLY bypasses the $100 balance access gate for navigation/screens.
 */

// Production: review/testing access mode is OFF. The $100 balance gate and
// real authenticated access rules are enforced. To temporarily re-enable
// review mode for staging, set VITE_REVIEW_ACCESS_MODE=true.
const REVIEW_ACCESS_MODE_DEFAULT = false;

const envFlag = import.meta.env.VITE_REVIEW_ACCESS_MODE as string | undefined;

export const reviewAccessModeEnabled: boolean =
  envFlag === undefined ? REVIEW_ACCESS_MODE_DEFAULT : envFlag === "true";

export const MIN_BALANCE_USD = 100;

export interface AccessAccountLike {
  account_type?: string | null;
  status?: string | null;
  balance?: number | null;
}

export type AccessDecisionReason =
  | "ok"
  | "review_access_mode"
  | "no_account"
  | "not_live"
  | "not_verified"
  | "low_balance";

export interface AccessDecision {
  allowed: boolean;
  reason: AccessDecisionReason;
}

/**
 * Single source of truth for "can this user access the full platform?".
 * Do not duplicate this logic elsewhere — extend this function instead.
 */
export function canAccessFullPlatform(
  account: AccessAccountLike | null | undefined,
  config: { reviewAccessModeEnabled: boolean } = {
    reviewAccessModeEnabled,
  },
): AccessDecision {
  if (config.reviewAccessModeEnabled) {
    // Audit/logging hook — visible in browser console for internal review.
    if (typeof console !== "undefined") {
      console.debug(
        "[access] access_granted_reason=review_access_mode (balance gate bypassed)",
      );
    }
    return { allowed: true, reason: "review_access_mode" };
  }

  if (!account) return { allowed: false, reason: "no_account" };
  if (account.account_type !== "live") return { allowed: false, reason: "not_live" };
  if (account.status !== "connected") return { allowed: false, reason: "not_verified" };
  if ((account.balance ?? 0) < MIN_BALANCE_USD) {
    return { allowed: false, reason: "low_balance" };
  }
  return { allowed: true, reason: "ok" };
}
