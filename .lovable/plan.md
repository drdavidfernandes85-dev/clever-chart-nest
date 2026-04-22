

## Futuristic Trading Background — Plan

Replace the current "Topographical Gold" background with a modern, financial-themed ambient scene that lives sitewide behind every page. Theme: **"Liquid Capital"** — a dark, depth-rich market environment evoking charts, capital flow, and elite community.

### Visual concept

Five layered, GPU-friendly CSS/SVG layers, all behind content (`z-0`, `pointer-events-none`):

1. **Deep market base** — radial vignette in near-black with a subtle gold/green warm core (gold = money, green = bullish charts).
2. **Animated candlestick skyline** — a faint, slow-drifting row of stylized SVG candlesticks across the lower third (green/red, very low opacity) suggesting a market chart horizon.
3. **Flowing chart lines** — 3-4 SVG polylines drawn like price action / EKG with a slow `stroke-dashoffset` animation so they appear to "draw" continuously left-to-right.
4. **Capital flow particles** — small gold/green dots drifting upward (like rising capital / order flow), each with random delay & duration.
5. **Hex / data-grid mesh** — a soft hexagonal SVG pattern (community + tech feel), masked with a radial gradient so it fades to the edges.
6. **Top vignette + bottom seam** — keeps foreground content readable and lets the hero laptop blend in cleanly.

Light mode gets the same composition with inverted base (warm off-white, muted gold/teal accents, lower opacities) so it stays elegant, not noisy.

### Files

**Edit** `src/components/AnimatedBackground.tsx`
- Replace current implementation with the new 6-layer scene described above
- Keep the same export/signature so `App.tsx` consumers don't change
- Reuse `useTheme()` for dark/light variants
- Keep all motion `transform`/`opacity` based; respect `prefers-reduced-motion` by gating animations

**Edit** `src/index.css`
- Add new keyframes: `capital-rise` (particles), `chart-draw` (stroke-dashoffset), `candle-drift` (slow horizontal drift), `hex-pulse` (mesh subtle breathing)
- Remove unused keyframes (`mesh-rotate`, `current-drift`, `contour-pulse`, `spark-rise`, `dust-drift`) only if no other component references them — will verify with search before deleting; otherwise leave intact

**No changes** to `HeroSection.tsx`, layout, or routing. The laptop hero already blends via its own ambient layer and will sit naturally over the new background.

### Technical notes

- All layers use `position: absolute` inside the existing `fixed inset-0 z-0` wrapper — no layout impact.
- Candlesticks and chart lines are inline SVG (no extra requests) with `vectorEffect="non-scaling-stroke"`.
- Particle count capped at ~20 to stay light on mobile.
- Color tokens: gold `hsl(48 95% 60%)`, bull green `hsl(145 65% 50%)`, bear red `hsl(0 70% 55%)` — used at 0.08–0.25 opacity so content always reads first.
- `prefers-reduced-motion: reduce` → all animations paused, static composition still looks intentional.

### ASCII layout

```text
┌──────────────────────────────────────────┐
│  vignette + hex mesh (faded edges)       │
│       ╱╲    ╱╲      flowing chart        │
│   ───╱  ╲──╱  ╲────  lines (animated)    │
│  · gold particles rising ·  ·            │
│  ▌▌ ▍▍ ▐▐ ▍▍ ▌▌  candle skyline drift    │
│  bottom seam → next section              │
└──────────────────────────────────────────┘
```

