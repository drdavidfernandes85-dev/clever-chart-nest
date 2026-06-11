// Centralised MT5 integer-enum decodes. Every consumer of TL/MT5 raw payloads
// MUST route through this module — never re-implement substring checks like
// `String(x).includes("sell")` which silently mis-decode the numeric `1` that
// MT5 actually returns. Reference: MQL5 ENUM_POSITION_TYPE, ENUM_DEAL_TYPE,
// ENUM_DEAL_ENTRY, ENUM_ORDER_TYPE, ENUM_ORDER_TYPE_TIME.

export type Side = "buy" | "sell";

/** ENUM_POSITION_TYPE: 0 = BUY, 1 = SELL. Accepts raw int, numeric string,
 *  or any textual alias (buy/sell/long/short/position_type_buy/...). */
export function decodePositionSide(raw: unknown): Side | null {
  if (raw === 0 || raw === "0") return "buy";
  if (raw === 1 || raw === "1") return "sell";
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "buy" || v === "long" || v === "position_type_buy") return "buy";
  if (v === "sell" || v === "short" || v === "position_type_sell") return "sell";
  // Last-resort substring (only when the raw is clearly textual, not numeric).
  if (/^[a-z_]+$/.test(v)) {
    if (v.includes("sell") || v.includes("short")) return "sell";
    if (v.includes("buy") || v.includes("long")) return "buy";
  }
  return null;
}

/** ENUM_DEAL_TYPE: 0 = BUY, 1 = SELL, 2..9 non-trade (balance/credit/...).
 *  Returns side for trade deals, null otherwise. */
export function decodeDealSide(rawType: unknown): Side | null {
  const n = Number(rawType);
  if (n === 0) return "buy";
  if (n === 1) return "sell";
  return null;
}

export function isTradeDeal(rawType: unknown): boolean {
  const n = Number(rawType);
  return n === 0 || n === 1;
}

/** ENUM_DEAL_ENTRY: 0=IN, 1=OUT, 2=INOUT (reversal), 3=OUT_BY (close-by). */
export type DealEntry = "in" | "out" | "inout" | "out_by";
export function decodeDealEntry(raw: unknown): DealEntry | null {
  const n = Number(raw);
  if (n === 0) return "in";
  if (n === 1) return "out";
  if (n === 2) return "inout";
  if (n === 3) return "out_by";
  return null;
}

/** ENUM_ORDER_TYPE: 0=BUY,1=SELL,2=BUY_LIMIT,3=SELL_LIMIT,
 *  4=BUY_STOP,5=SELL_STOP,6=BUY_STOP_LIMIT,7=SELL_STOP_LIMIT. */
export type OrderKind = "market" | "limit" | "stop" | "stop_limit";
export interface DecodedOrderType { kind: OrderKind; side: Side; }
const ORDER_TYPE_MAP: Record<number, DecodedOrderType> = {
  0: { kind: "market",     side: "buy"  },
  1: { kind: "market",     side: "sell" },
  2: { kind: "limit",      side: "buy"  },
  3: { kind: "limit",      side: "sell" },
  4: { kind: "stop",       side: "buy"  },
  5: { kind: "stop",       side: "sell" },
  6: { kind: "stop_limit", side: "buy"  },
  7: { kind: "stop_limit", side: "sell" },
};
export function decodeOrderType(raw: unknown): DecodedOrderType | null {
  const n = Number(raw);
  return ORDER_TYPE_MAP[n] ?? null;
}

/** ENUM_ORDER_TYPE_TIME: 0=GTC,1=DAY,2=SPECIFIED(GTD),3=SPECIFIED_DAY. */
export type OrderDuration = "GTC" | "DAY" | "GTD" | "SPECIFIED_DAY";
export function decodeOrderTypeTime(raw: unknown): OrderDuration {
  const n = Number(raw);
  if (n === 1) return "DAY";
  if (n === 2) return "GTD";
  if (n === 3) return "SPECIFIED_DAY";
  return "GTC";
}
