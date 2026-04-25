import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

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
