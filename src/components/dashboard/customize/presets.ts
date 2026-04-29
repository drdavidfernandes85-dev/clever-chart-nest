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
  "recentActivity",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  portfolio: "Portfolio Overview",
  risk: "Risk Exposure",
  watchlist: "Watchlist",
  marketMovers: "Market Movers",
  recentActivity: "Recent Activity",
};

/** Sensible per-widget min sizes (12-col grid). */
export const WIDGET_MIN: Record<WidgetId, { w: number; h: number }> = {
  portfolio: { w: 5, h: 9 },
  risk: { w: 3, h: 7 },
  watchlist: { w: 3, h: 9 },
  marketMovers: { w: 4, h: 8 },
  recentActivity: { w: 3, h: 6 },
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
 * Default layout — taller rows so content fits without internal scrolling.
 *  Row 1 (h=10): Portfolio (hero, 6w) + Risk (3w) + Quick Trade rail (3w, spans rows 1+2 → h=20)
 *  Row 2 (h=10): Watchlist (4w)       + Market Movers (5w)
 *  Row 3 (h=7):  Live Shared Signals (7w) + Recent Activity (5w)
 *
 * 12-col grid; rowHeight=56 → row 1 ≈ 560px, plenty for portfolio + open positions.
 */
export const PRESETS: Preset[] = [
  {
    id: "classic",
    name: "Classic Terminal",
    description: "Logical trader workflow — context, action, opportunity, community",
    lg: [
      // Row 1 — context: portfolio hero (tall) + risk + quickTrade rail
      make("portfolio", 0, 0, 6, 13),
      make("risk", 6, 0, 3, 13),
      make("quickTrade", 9, 0, 3, 16),
      // Row 2 — opportunity scan: watchlist + market movers (compact)
      make("watchlist", 0, 13, 4, 11),
      make("marketMovers", 4, 13, 5, 8),
      // Row 3 — community + history (full width split)
      make("liveSignals", 0, 24, 7, 8),
      make("recentActivity", 7, 24, 5, 8),
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
