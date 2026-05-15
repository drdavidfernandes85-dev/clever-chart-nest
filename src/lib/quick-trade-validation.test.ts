import { describe, it, expect } from "vitest";
import {
  validateStops,
  getEffectiveStops,
  matchQuote,
  STOPS_INVALID_MESSAGE,
} from "./quick-trade-validation";

describe("validateStops — BUY", () => {
  const base = { side: "buy" as const, currentPrice: 100, noStops: false };

  it("accepts SL below price and TP above price", () => {
    expect(validateStops({ ...base, sl: 95, tp: 110 })).toBeNull();
  });

  it("rejects SL at or above price", () => {
    expect(validateStops({ ...base, sl: 100, tp: null })).toBe(STOPS_INVALID_MESSAGE);
    expect(validateStops({ ...base, sl: 105, tp: null })).toBe(STOPS_INVALID_MESSAGE);
  });

  it("rejects TP at or below price", () => {
    expect(validateStops({ ...base, sl: null, tp: 100 })).toBe(STOPS_INVALID_MESSAGE);
    expect(validateStops({ ...base, sl: null, tp: 90 })).toBe(STOPS_INVALID_MESSAGE);
  });
});

describe("validateStops — SELL", () => {
  const base = { side: "sell" as const, currentPrice: 100, noStops: false };

  it("accepts SL above price and TP below price", () => {
    expect(validateStops({ ...base, sl: 110, tp: 90 })).toBeNull();
  });

  it("rejects SL at or below price", () => {
    expect(validateStops({ ...base, sl: 100, tp: null })).toBe(STOPS_INVALID_MESSAGE);
    expect(validateStops({ ...base, sl: 95, tp: null })).toBe(STOPS_INVALID_MESSAGE);
  });

  it("rejects TP at or above price", () => {
    expect(validateStops({ ...base, sl: null, tp: 100 })).toBe(STOPS_INVALID_MESSAGE);
    expect(validateStops({ ...base, sl: null, tp: 110 })).toBe(STOPS_INVALID_MESSAGE);
  });
});

describe("validateStops — edge cases", () => {
  it("returns null when no stops provided", () => {
    expect(
      validateStops({ side: "buy", currentPrice: 100, sl: null, tp: null, noStops: false }),
    ).toBeNull();
  });

  it("returns null when current price is unavailable", () => {
    expect(
      validateStops({ side: "buy", currentPrice: null, sl: 9999, tp: 1, noStops: false }),
    ).toBeNull();
  });

  it("ignores SL/TP when noStops is true (always valid)", () => {
    expect(
      validateStops({ side: "buy", currentPrice: 100, sl: 200, tp: 1, noStops: true }),
    ).toBeNull();
    expect(
      validateStops({ side: "sell", currentPrice: 100, sl: 1, tp: 200, noStops: true }),
    ).toBeNull();
  });

  it("treats zero/NaN SL or TP as missing", () => {
    expect(
      validateStops({ side: "buy", currentPrice: 100, sl: 0, tp: NaN, noStops: false }),
    ).toBeNull();
  });
});

describe("getEffectiveStops", () => {
  it("returns provided values when valid and noStops is false", () => {
    expect(getEffectiveStops({ sl: 95, tp: 110, noStops: false })).toEqual({
      stopLoss: 95,
      takeProfit: 110,
    });
  });

  it("forces both to null when noStops is true", () => {
    expect(getEffectiveStops({ sl: 95, tp: 110, noStops: true })).toEqual({
      stopLoss: null,
      takeProfit: null,
    });
  });

  it("nulls out missing/invalid fields independently", () => {
    expect(getEffectiveStops({ sl: null, tp: 110, noStops: false })).toEqual({
      stopLoss: null,
      takeProfit: 110,
    });
    expect(getEffectiveStops({ sl: 0, tp: null, noStops: false })).toEqual({
      stopLoss: null,
      takeProfit: null,
    });
  });
});

describe("matchQuote", () => {
  const quotes = [
    { symbol: "EUR/USD", price: 1.08 },
    { symbol: "XAUUSD", price: 2400 },
    { symbol: "BTCUSDT", price: 65000 },
    { symbol: "NO_PRICE", price: null },
  ];

  it("matches exact symbol ignoring punctuation", () => {
    expect(matchQuote("EURUSD", quotes)?.price).toBe(1.08);
  });

  it("matches when broker symbol has a decorated suffix", () => {
    expect(matchQuote("EURUSD.m", quotes)?.price).toBe(1.08);
    expect(matchQuote("EURUSDi", quotes)?.price).toBe(1.08);
    expect(matchQuote("#EURUSD", quotes)?.price).toBe(1.08);
  });

  it("matches via aliases (XAUUSD ↔ GOLD, BTC variants)", () => {
    expect(matchQuote("GOLD", quotes)?.price).toBe(2400);
    expect(matchQuote("BTCUSD", quotes)?.price).toBe(65000);
  });

  it("ignores quotes with null price", () => {
    expect(matchQuote("NO_PRICE", quotes)).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(matchQuote("AAPL", quotes)).toBeNull();
  });
});
