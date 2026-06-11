import { describe, it, expect } from "vitest";
import { reconstructClose, type LiveSpec, type Position } from "./JournalDashboardPanel";

const XAUUSD: LiveSpec = { contractSize: 100, profitCcy: "USD", digits: 2, point: 0.01 };
const EURJPY: LiveSpec = { contractSize: 100000, profitCcy: "JPY", digits: 3, point: 0.001 };

function pos(over: Partial<Position>): Position {
  return {
    user_id: null, mt_login: null, position_id: null, symbol: "XAUUSD",
    side: "buy", open_time: null, close_time: null,
    volume_in: 0.01, volume_out: 0.01,
    vwap_open: null, vwap_close: null,
    net_pnl: null, gross_profit: null,
    swap_total: 0, commission_total: 0, fee_total: 0,
    deal_count: 2, is_closed: true, has_complex_entry: false,
    ...over,
  };
}

describe("reconstructClose — numerator = deal.profit only", () => {
  // Portal-truth fixtures (verified against MT5 portal).
  it("XAUUSD #1131810037 buy 0.01 @5008.89 profit=+1.52 → close=5010.41", () => {
    const r = reconstructClose(
      pos({ side: "buy", volume_out: 0.01, vwap_open: 5008.89, gross_profit: 1.52, net_pnl: 1.52 }),
      XAUUSD, "USD",
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.close).toBeCloseTo(5010.41, 2);
  });

  it("XAUUSD #1131813338 buy 0.01 @5010.58 profit=−18 → close=4992.58", () => {
    const r = reconstructClose(
      pos({ side: "buy", volume_out: 0.01, vwap_open: 5010.58, gross_profit: -18, net_pnl: -18 }),
      XAUUSD, "USD",
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.close).toBeCloseTo(4992.58, 2);
  });

  it("XAUUSD #1131824306 sell 0.01 @4990.06 profit=+1.61 → close=4988.45", () => {
    const r = reconstructClose(
      pos({ side: "sell", volume_out: 0.01, vwap_open: 4990.06, gross_profit: 1.61, net_pnl: 1.61 }),
      XAUUSD, "USD",
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.close).toBeCloseTo(4988.45, 2);
  });

  // No fee-bearing deal exists in the current synced set (all 64 XAUUSD have
  // commission_total=fee_total=0, swap_total=0 for most). This fixture pins the
  // formula so the first real fee-bearing deal cannot silently shift it:
  // derivation MUST ignore swap/commission/fee — only deal.profit (=gross_profit)
  // is the numerator. Otherwise close would drift by fees/cs/vol per row.
  it("ignores swap/commission/fee in the numerator (synthetic fixture)", () => {
    // Synthetic: buy 1.00 XAUUSD, open 2000.00, broker reports profit=+50 with
    // swap=-2, commission=-7, fee=-1. Real close MUST be 2000.50, not 2000.40.
    const r = reconstructClose(
      pos({
        side: "buy", volume_in: 1, volume_out: 1,
        vwap_open: 2000.00,
        gross_profit: 50,       // numerator
        swap_total: -2, commission_total: -7, fee_total: -1,
        net_pnl: 40,            // post-fees; must NOT be used
      }),
      XAUUSD, "USD",
    );
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.close).toBeCloseTo(2000.50, 5);
  });

  it("rejects currency mismatch (no FX conversion)", () => {
    const r = reconstructClose(
      pos({ symbol: "EURJPY", side: "buy", volume_out: 0.01, vwap_open: 165.000, gross_profit: 10 }),
      EURJPY, "USD",
    );
    expect(r.kind).toBe("ccy_mismatch");
  });

  it("rejects when spec is missing (no hardcoded fallback)", () => {
    const r = reconstructClose(
      pos({ vwap_open: 100, gross_profit: 5 }),
      null, "USD",
    );
    expect(r.kind).toBe("no_spec");
  });
});
