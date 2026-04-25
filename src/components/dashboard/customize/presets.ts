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

/** ── 5 professional presets ── */
export const PRESETS: Preset[] = [
  {
    id: "classic",
    name: "Classic Terminal",
    description: "Portfolio hero • Risk + Watchlist rail • Movers below",
    lg: [
      make("portfolio", 0, 0, 8, 9),
      make("risk", 8, 0, 4, 6),
      make("watchlist", 8, 6, 4, 7),
      make("marketMovers", 0, 9, 8, 7),
      make("liveSignals", 0, 16, 6, 6),
      make("recentActivity", 6, 16, 6, 6),
      make("quickTrade", 8, 13, 4, 9),
    ],
  },
  {
    id: "chartFocused",
    name: "Chart Focused",
    description: "Portfolio takes the spotlight • supporting widgets compact",
    lg: [
      make("portfolio", 0, 0, 12, 11),
      make("marketMovers", 0, 11, 8, 7),
      make("watchlist", 8, 11, 4, 7),
      make("risk", 0, 18, 4, 6),
      make("liveSignals", 4, 18, 4, 6),
      make("quickTrade", 8, 18, 4, 9),
      make("recentActivity", 0, 24, 12, 5),
    ],
  },
  {
    id: "riskFirst",
    name: "Risk-First",
    description: "Risk + Quick Trade up top — built for active risk control",
    lg: [
      make("risk", 0, 0, 6, 7),
      make("quickTrade", 6, 0, 6, 9),
      make("portfolio", 0, 7, 6, 9),
      make("watchlist", 6, 9, 6, 7),
      make("marketMovers", 0, 16, 8, 6),
      make("liveSignals", 8, 16, 4, 6),
      make("recentActivity", 0, 22, 12, 5),
    ],
  },
  {
    id: "communityPulse",
    name: "Community Pulse",
    description: "Live signals & activity in the lead — social trading vibe",
    lg: [
      make("liveSignals", 0, 0, 8, 8),
      make("recentActivity", 8, 0, 4, 8),
      make("portfolio", 0, 8, 8, 8),
      make("watchlist", 8, 8, 4, 8),
      make("marketMovers", 0, 16, 6, 6),
      make("risk", 6, 16, 3, 6),
      make("quickTrade", 9, 16, 3, 9),
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Just the essentials — Portfolio, Risk, Watchlist",
    lg: [
      make("portfolio", 0, 0, 8, 10),
      make("risk", 8, 0, 4, 6),
      make("watchlist", 8, 6, 4, 8),
      make("marketMovers", 0, 10, 8, 6),
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
