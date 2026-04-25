import type { LayoutItem } from "react-grid-layout";

/**
 * Widget IDs for the customizable dashboard.
 * Each ID maps to a renderable widget in `widgetRegistry`.
 */
export const WIDGET_IDS = [
  "portfolio",
  "risk",
  "watchlist",
  "marketMovers",
  "liveSignals",
  "quickTrade",
  "recentActivity",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  portfolio: "Portfolio Overview",
  risk: "Risk Exposure",
  watchlist: "Watchlist",
  marketMovers: "Market Movers",
  liveSignals: "Live Shared Signals",
  quickTrade: "Quick Trade",
  recentActivity: "Recent Activity",
};

/** Sensible per-widget min sizes (12-col grid). */
export const WIDGET_MIN: Record<WidgetId, { w: number; h: number }> = {
  portfolio: { w: 6, h: 8 },
  risk: { w: 3, h: 6 },
  watchlist: { w: 3, h: 6 },
  marketMovers: { w: 6, h: 6 },
  liveSignals: { w: 3, h: 6 },
  quickTrade: { w: 3, h: 8 },
  recentActivity: { w: 4, h: 5 },
};

export type PresetId =
  | "classic"
  | "chartFocused"
  | "riskFirst"
  | "communityPulse"
  | "minimal";

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  /** Layout for the lg (1200+) breakpoint. md/sm/xs derived automatically. */
  lg: LayoutItem[];
}

const make = (i: WidgetId, x: number, y: number, w: number, h: number): LayoutItem => ({
  i,
  x,
  y,
  w,
  h,
  minW: WIDGET_MIN[i].w,
  minH: WIDGET_MIN[i].h,
});

/**
 * Default layout — clean grid with no gaps, ordered by trader workflow:
 *  Row 1 (h=9):  Portfolio (hero)        + Risk          + Quick Trade rail (spans 2 rows)
 *  Row 2 (h=9):  Watchlist               + Market Movers + (Quick Trade continues)
 *  Row 3 (h=8):  Live Shared Signals     + Recent Activity (full width)
 *
 * 12-col grid, every row aligns cleanly — no orphaned vertical gaps.
 */
export const PRESETS: Preset[] = [
  {
    id: "classic",
    name: "Classic Terminal",
    description: "Logical trader workflow — context, action, opportunity, community",
    lg: [
      // Row 1 — context
      make("portfolio", 0, 0, 6, 9),
      make("risk", 6, 0, 3, 9),
      make("quickTrade", 9, 0, 3, 18),
      // Row 2 — opportunity scan (aligned under Portfolio + Risk)
      make("watchlist", 0, 9, 4, 9),
      make("marketMovers", 4, 9, 5, 9),
      // Row 3 — community + history (full width, equal split)
      make("liveSignals", 0, 18, 7, 8),
      make("recentActivity", 7, 18, 5, 8),
    ],
  },
];

export const DEFAULT_PRESET: PresetId = "classic";

/** Derive layouts for md / sm / xs from the lg layout (responsive cascade). */
export function buildResponsiveLayouts(lg: LayoutItem[]) {
  // md: 10 cols — proportional shrink
  const md: LayoutItem[] = lg.map((l) => ({
    ...l,
    w: Math.max(l.minW || 3, Math.min(10, Math.round((l.w / 12) * 10))),
    x: Math.min(10 - 1, Math.round((l.x / 12) * 10)),
  }));
  // sm: 6 cols — half-width tiles
  const sm: LayoutItem[] = lg.map((l) => ({
    ...l,
    w: Math.min(6, Math.max(3, Math.ceil(l.w / 2))),
    x: l.x < 6 ? 0 : 0,
    y: l.y,
  }));
  // xs: single column (mobile fallback)
  const xs: LayoutItem[] = lg.map((l) => ({ ...l, w: 4, x: 0, y: l.y }));
  return { lg, md, sm, xs };
}

export function getPreset(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
