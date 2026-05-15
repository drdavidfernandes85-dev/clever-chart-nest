// Pure helpers used by Quick Trade for SL/TP validation and quote matching.
// Kept side-effect free so they can be unit tested in isolation.

export type Side = "buy" | "sell";

export interface ValidateStopsInput {
  side: Side;
  currentPrice: number | null;
  sl: number | null;
  tp: number | null;
  noStops: boolean;
}

export const STOPS_INVALID_MESSAGE =
  "Invalid Stop Loss or Take Profit for current market price.";

/**
 * Returns null when the stops are valid (or cannot be validated yet),
 * otherwise a user-facing error message.
 *
 * Rules:
 *  - If noStops is true, both SL and TP are ignored (sent as null).
 *  - If neither SL nor TP is provided, nothing to validate.
 *  - If currentPrice is unavailable, allow the trade — caller decides
 *    whether to display a "price unavailable" hint.
 *  - BUY: SL must be strictly below current price, TP strictly above.
 *  - SELL: SL must be strictly above current price, TP strictly below.
 */
export function validateStops({
  side,
  currentPrice,
  sl,
  tp,
  noStops,
}: ValidateStopsInput): string | null {
  if (noStops) return null;
  const hasSl = sl != null && !isNaN(sl) && sl > 0;
  const hasTp = tp != null && !isNaN(tp) && tp > 0;
  if (!hasSl && !hasTp) return null;
  if (currentPrice == null || isNaN(currentPrice)) return null;

  if (side === "buy") {
    if (hasSl && (sl as number) >= currentPrice) return STOPS_INVALID_MESSAGE;
    if (hasTp && (tp as number) <= currentPrice) return STOPS_INVALID_MESSAGE;
  } else {
    if (hasSl && (sl as number) <= currentPrice) return STOPS_INVALID_MESSAGE;
    if (hasTp && (tp as number) >= currentPrice) return STOPS_INVALID_MESSAGE;
  }
  return null;
}

/**
 * Effective SL/TP that should be sent to the broker — null whenever the
 * field is empty/invalid OR the user opted into "Place trade without SL/TP".
 */
export function getEffectiveStops({
  sl,
  tp,
  noStops,
}: {
  sl: number | null;
  tp: number | null;
  noStops: boolean;
}): { stopLoss: number | null; takeProfit: number | null } {
  const hasSl = sl != null && !isNaN(sl) && sl > 0;
  const hasTp = tp != null && !isNaN(tp) && tp > 0;
  return {
    stopLoss: noStops || !hasSl ? null : (sl as number),
    takeProfit: noStops || !hasTp ? null : (tp as number),
  };
}

// ── Quote matching ───────────────────────────────────────────────────

const norm = (s: string) =>
  (s ?? "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");

// Common broker aliases — same intent as the symbol resolver in QuickTradePanel.
const ALIASES: Record<string, string[]> = {
  XAUUSD: ["GOLD"],
  GOLD: ["XAUUSD"],
  XAGUSD: ["SILVER"],
  SILVER: ["XAGUSD"],
  US30: ["DJ30", "DOW30", "WS30", "USA30"],
  NAS100: ["NDX100", "USTEC", "USA100", "NQ100"],
  SPX500: ["US500", "SP500", "USA500"],
  GER40: ["DAX40", "DE40", "GER30"],
  BTCUSD: ["BTCUSDT", "BITCOIN"],
  BTCUSDT: ["BTCUSD"],
};

interface QuoteLike {
  symbol: string;
  price: number | null;
}

/**
 * Find the live quote for a broker symbol, tolerating prefix/suffix
 * decorations (e.g. "EURUSD.m", "EURUSDi", "#EURUSD") and common aliases
 * (XAUUSD ↔ GOLD, BTCUSD ↔ BTCUSDT, …).
 *
 * Match priority:
 *   1. Exact normalized equality
 *   2. Alias equality
 *   3. Quote symbol contains target (suffix/prefix decoration)
 *   4. Target contains quote symbol (broker uses shorter root)
 */
export function matchQuote<T extends QuoteLike>(
  brokerSymbol: string,
  quotes: T[],
): T | null {
  if (!brokerSymbol || !quotes.length) return null;
  const target = norm(brokerSymbol);
  if (!target) return null;
  const candidates = new Set<string>([
    target,
    ...(ALIASES[target] ?? []).map(norm),
  ]);
  const valid = quotes.filter((q) => q.price != null && !isNaN(q.price as number));

  // 1. Exact normalized
  for (const q of valid) {
    if (candidates.has(norm(q.symbol))) return q;
  }
  // 2. Quote contains a candidate (broker decorations like .m, i, #, _i)
  for (const q of valid) {
    const n = norm(q.symbol);
    for (const c of candidates) {
      if (c && n.length > c.length && n.includes(c)) return q;
    }
  }
  // 3. Target contains the quote symbol (broker uses a shorter root)
  for (const q of valid) {
    const n = norm(q.symbol);
    if (n && target.length > n.length && target.includes(n)) return q;
  }
  return null;
}
