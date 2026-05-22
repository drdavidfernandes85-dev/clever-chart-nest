/**
 * Lightweight market-session availability checks for the admin live testing
 * terminal. Used to gate live test submissions and surface clear "Market closed"
 * messaging instead of letting orders reach the broker and come back as a
 * TRADE_RETCODE_TRADE_DISABLED rejection.
 *
 * This file ONLY observes; it never sends orders, never bypasses risk, kill
 * switches, fresh-tick checks, or the Trading Layer mapping resolver.
 *
 * Inference order, per symbol:
 *   1. If we have a recent executable tick (bid/ask), session = open.
 *   2. Otherwise classify by symbol/asset class:
 *      - forex / metals: closed Fri 22:00 UTC → Sun 22:00 UTC.
 *      - crypto: always open.
 *      - everything else: unknown (do not block, do not assert open).
 */

export type SessionState = "open" | "closed" | "unknown";
export type SessionSource =
  | "broker_status"
  | "recent_tick_inference"
  | "weekend_rule"
  | "unknown";
export type ExecutionPrecheck = "eligible" | "blocked" | "unknown";

export interface SessionAvailability {
  /** Inferred session state for the symbol. */
  session: SessionState;
  /** Execution precheck verdict — backend re-checks independently. */
  precheck: ExecutionPrecheck;
  /** Origin of the decision (explicit broker > tick inference > weekend > unknown). */
  source: SessionSource;
  /** Whether the symbol is currently tradable as far as we can tell. */
  tradable: boolean;
  /** Age of the most recent executable tick in ms, or null. */
  tickAgeMs: number | null;
  /** Human-readable reason for the current state. */
  reason: string;
  /** Pre-submission classification for the live test matrix, if blocking. */
  precheckClassification:
    | "market_closed_precheck"
    | "symbol_not_tradable_precheck"
    | "no_executable_tick_precheck"
    | null;
}

const FOREX_RE = /^(?:[A-Z]{6}|XAU|XAG|GOLD|SILV|WTI|USOIL|UKOIL|BRENT|NGAS)/;
const CRYPTO_RE = /(BTC|ETH|USDT|SOL|XRP|ADA|DOGE|BNB|MATIC|DOT)/;

const FRESH_TICK_MAX_AGE_MS = 60_000;

/** Returns true if the given UTC date falls inside the forex weekend window. */
export function isForexWeekend(now: Date = new Date()): boolean {
  const day = now.getUTCDay(); // 0 = Sun
  const hour = now.getUTCHours();
  if (day === 6) return true;                       // Saturday
  if (day === 5 && hour >= 22) return true;         // Fri ≥ 22:00 UTC
  if (day === 0 && hour < 22) return true;          // Sun < 22:00 UTC
  return false;
}

/**
 * Best-effort, read-only check. `tick` is the most recent executable tick we
 * already have in the order ticket (bid/ask + updatedAt) — we do not make any
 * network call from here.
 */
export function getSessionAvailability(input: {
  symbol: string | null | undefined;
  bid?: number | null;
  ask?: number | null;
  tickUpdatedAt?: number | string | Date | null;
  now?: Date;
}): SessionAvailability {
  const now = input.now ?? new Date();
  const sym = (input.symbol || "").toUpperCase();
  const bidOk = Number.isFinite(Number(input.bid));
  const askOk = Number.isFinite(Number(input.ask));

  let tickAgeMs: number | null = null;
  if (input.tickUpdatedAt != null) {
    const t =
      input.tickUpdatedAt instanceof Date
        ? input.tickUpdatedAt.getTime()
        : typeof input.tickUpdatedAt === "string"
        ? Date.parse(input.tickUpdatedAt)
        : Number(input.tickUpdatedAt);
    if (Number.isFinite(t)) tickAgeMs = Math.max(0, now.getTime() - t);
  }

  const hasExecutableTick =
    (bidOk || askOk) && tickAgeMs != null && tickAgeMs <= FRESH_TICK_MAX_AGE_MS;

  // 1) Recent executable tick is the strongest signal we have client-side.
  if (hasExecutableTick) {
    return {
      session: "open",
      precheck: "eligible",
      source: "recent_tick_inference",
      tradable: true,
      tickAgeMs,
      reason: "Recent executable tick observed.",
      precheckClassification: null,
    };
  }

  // 2) Symbol-class heuristics.
  if (CRYPTO_RE.test(sym)) {
    return {
      session: "open",
      precheck: "eligible",
      source: "recent_tick_inference",
      tradable: true,
      tickAgeMs,
      reason: "Crypto market trades 24/7.",
      precheckClassification: null,
    };
  }

  if (FOREX_RE.test(sym)) {
    if (isForexWeekend(now)) {
      return {
        session: "closed",
        precheck: "blocked",
        source: "weekend_rule",
        tradable: false,
        tickAgeMs,
        reason: "Forex weekend — market closed.",
        precheckClassification: "market_closed_precheck",
      };
    }
    if (!bidOk && !askOk) {
      return {
        session: "unknown",
        precheck: "blocked",
        source: "recent_tick_inference",
        tradable: false,
        tickAgeMs,
        reason: "No executable tick available for symbol.",
        precheckClassification: "no_executable_tick_precheck",
      };
    }
    return {
      session: "unknown",
      precheck: "unknown",
      source: "recent_tick_inference",
      tradable: true,
      tickAgeMs,
      reason: "Last-known tick available but not fresh.",
      precheckClassification: null,
    };
  }

  // 3) Unknown asset class — do not assert state.
  return {
    session: "unknown",
    precheck: "unknown",
    source: "unknown",
    tradable: bidOk || askOk,
    tickAgeMs,
    reason: "Session state unknown for this symbol.",
    precheckClassification: null,
  };
}

export function formatTickAge(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

/**
 * Live-test matrix helpers — classifications used in evidence_json and in the
 * Admin Production verification logic.
 */
export const PRECHECK_CLASSIFICATIONS = [
  "market_closed_precheck",
  "symbol_not_tradable_precheck",
  "no_executable_tick_precheck",
] as const;

export const NON_BLOCKING_REJECTION_CLASSIFICATIONS = [
  "order_rejected_market_closed",
  "order_rejected_trade_disabled_outside_session",
] as const;

export const BLOCKING_REJECTION_CLASSIFICATIONS = [
  "order_rejected_trade_disabled_during_open_session",
] as const;
