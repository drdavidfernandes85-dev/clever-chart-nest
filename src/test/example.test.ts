import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { computeMentorTier } from "../lib/mentor-tier";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Community Hub spacing guard", () => {
  it("keeps rail padding, gaps, rows, and footer spacing aligned", () => {
    const rail = readSource("src/components/chatroom/CommunityHubRail.tsx");

    expect(rail).toContain("gap-2 overflow-y-auto px-2 py-2 pb-3");
    expect(rail).toContain("sm:gap-2.5 sm:px-2.5 sm:py-2.5 lg:gap-3 lg:p-3");
    expect(rail).toContain("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5");
    expect(rail).toContain("grid grid-cols-[1rem_1.75rem_minmax(0,1fr)_4.25rem] items-center gap-2 px-2.5 py-1.5");
    expect(rail).toContain("rounded-xl border border-border/30 bg-card/40 px-2.5 py-2");
  });

  it("keeps Live Shared Signals scroll adaptive and padded with the rail", () => {
    const signals = readSource("src/components/dashboard/LiveSharedSignals.tsx");

    expect(signals).toContain("max-h-[420px] overflow-y-auto divide-y divide-border/30 px-2 py-1.5 sm:px-2.5");
    expect(signals).toContain("px-1 py-2 transition-colors hover:bg-primary/5 sm:px-1.5");
    expect(signals).toContain("grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2");
    expect(signals).toContain("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg");
  });
});

describe("Mentor verification tiers", () => {
  it("returns null below Rising Star thresholds", () => {
    expect(computeMentorTier({ totalTrades: 19, winRate: 80 })).toBeNull();
    expect(computeMentorTier({ totalTrades: 100, winRate: 50 })).toBeNull();
  });

  it("awards Rising Star for 20+ trades and >50% win rate", () => {
    expect(computeMentorTier({ totalTrades: 20, winRate: 51 })?.id).toBe("rising_star");
  });

  it("awards Verified Trader at 50 trades and >58% wr", () => {
    expect(computeMentorTier({ totalTrades: 50, winRate: 59 })?.id).toBe("verified_trader");
  });

  it("requires positive PnL for Mentor tier", () => {
    expect(
      computeMentorTier({ totalTrades: 120, winRate: 64, totalPnl: 1, pnl30d: -1 })?.id,
    ).toBe("verified_trader");
    expect(
      computeMentorTier({ totalTrades: 120, winRate: 64, totalPnl: 100, pnl30d: 50 })?.id,
    ).toBe("mentor");
  });

  it("awards Elite Mentor at 250 trades and >68% wr regardless of PnL", () => {
    expect(computeMentorTier({ totalTrades: 250, winRate: 69 })?.id).toBe("elite_mentor");
  });
});
