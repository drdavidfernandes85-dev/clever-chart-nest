# Full Mobile Responsiveness QA + Optimization Pass

This is a large multi-area pass. To keep it safe (no execution / risk / MT5 / reconciliation logic touched) and reviewable, I'll split it into 4 phases. Each phase ships independently so you can verify before the next.

## Scope guardrails (unchanged)

Will NOT touch:
- `supabase/functions/**` (all edge functions, including `reconcile-execution`, `execute-trade`, `close-position-controlled`, `mt-webhook`, risk, market data, symbol source)
- `src/lib/positionReconciliation.ts`, `src/lib/tradingLayerControl.ts`, `src/lib/quick-trade-validation.ts`
- Compliance copy in `ComplianceFooter`, `RiskDisclosure`, `Terms`, `TradingRoomDisclaimerModal`
- Launch readiness gating logic (only adds a new Mobile QA tile, no changes to existing gates)

Only presentational / layout / nav / a11y code in `src/**`.

---

## Phase 1 — Global foundations + Public site

Goal: kill horizontal overflow, fix nav, ensure all marketing pages stack cleanly 320–1440px.

1. **Global overflow guard** in `src/index.css`: `html, body { overflow-x: hidden; }`, `min-w-0` defaults on flex children where needed, ensure `h-dvh` over `h-screen` on full-height layouts.
2. **Safe-area utilities**: confirm `env(safe-area-inset-*)` is applied on fixed bars (`MobileBottomNav` already does; audit `FloatingMobileCTA`, modals).
3. **Navbar / mobile menu** (`src/components/Navbar.tsx`):
   - Verify hamburger open/close, focus trap, link list matches required public nav (Home, Education, Webinars, Community, News & Calendar, LTR Terminal Pro, FAQ, Login/Dashboard).
   - Hide unstable modules (Analytics, Leaderboard, Video Library) from mobile menu unless readiness gate allows.
   - Logo scales; language selector reachable.
4. **Homepage** (`Index.tsx`, `HeroSection`, `PlatformPillars`, `TeamSection`, `MentoringSection`, `TrustpilotSection`, `FAQSection`, `ContactSection`, `NewsletterSection`, `Footer`):
   - Stack grids to 1-col < 640px, 2-col md.
   - Hero: clamp font sizes, prevent 3D scene from causing overflow, lazy already in place.
   - Footer columns stack cleanly.
5. **Marketing / legal pages** (`Education`, `Webinars`, `Community`, `News`, `Ideas`, `CommunityGuidelines`, `Terms`, `RiskDisclosure`, `FAQSection`, `Login`, `Register`, `ForgotPassword`, `ResetPassword`): padding, typography scale, form input width, CTA stacking, no fixed widths.

## Phase 2 — Dashboard shell + dashboard pages

1. **DashboardLayout / MobileSidebarDrawer / DashboardSidebar**: verify drawer open/close, body scroll lock (already present), backdrop dismiss, focus return, active highlight, drawer width on tablet portrait.
2. **MobileBottomNav**: tap targets ≥44px (currently h-16 = 64px ✓), labels readable, hidden on /chatroom (already).
3. **Dashboard page** (`src/pages/Dashboard.tsx`): quick action cards stack vertically <640px in this order — Trading Room → Webinar → Ideas → Terminal → Connect MT5; service status card compact; refresh button reachable; admin/dev panels collapsed by default on mobile.
4. **Chatroom mobile**: input bar above bottom nav, message list height uses `dvh`, hub rail becomes drawer.
5. **Profile / ConnectMT / ConnectMyMT5**: form fields full-width, status cards stack, errors readable.
6. **Webinars / Ideas / News / Education modules / Education page**: card grids stack, filters wrap, calendar iframe responsive with retry/open-external buttons visible.

## Phase 3 — LTR Terminal Pro mobile strategy (Option A)

For viewports `< 768px` only: render a **Mobile Terminal Summary** instead of the full pro layout. The full terminal renders unchanged at `≥ 768px`.

New component `src/components/livechart/MobileTerminalSummary.tsx`:
- Connected account status (reuse `ConnectedAccountBadge` data via `useMTAccount` / `LiveAccountContext`)
- Selected symbol quote (reuse `useSelectedQuote`)
- Compact open positions summary (read-only, reuse existing data hooks, no new execution paths)
- Primary CTA: "Open Full Terminal on Desktop" + educational note
- Link to Trading Room and Connect MT5

`LiveChart.tsx` gets a `useIsMobile()` branch at the top that returns `<MobileTerminalSummary />`. No changes to execution, order ticket, reconciliation, or close-position code paths — they simply aren't mounted on phones.

Tablet 768–1024px: existing layout already responsive; add chart-full-width + collapsed right rail tabs check, no logic change.

## Phase 4 — Modals, tables, perf, a11y, Admin Launch Readiness Mobile QA tile

1. **Modals**: audit `Dialog`/`Drawer` usages (login/register, MT5 connect, execution result, close confirm, SL/TP modify, language selector). On `<640px`, force near-full-screen content with sticky header/footer so action buttons never clip. Add `max-h-[90dvh] overflow-y-auto` defaults where missing.
2. **Tables**: wrap `Table` containers in `overflow-x-auto` scoped to the card (not page). Positions/history/best-execution: add a mobile card-list fallback where the table is non-trivial.
3. **Perf**: confirm chart/TradingView is lazy (`lazyWithRetry`), reduce heavy blur/glow on `<md` via Tailwind variants (`md:backdrop-blur-xl`), keep animations gated by `prefers-reduced-motion`.
4. **A11y sweep**: aria-labels on icon buttons, focus-visible rings, tap target audit.
5. **Admin Launch Readiness — Mobile QA section** (`src/components/admin/AdminLaunchReadinessTab.tsx`): new card listing public/dashboard/terminal/tablet/modals/nav status, overflow findings, fixes applied, remaining issues, and terminal recommendation = "Option A: mobile summary, full terminal desktop/tablet only". Static content, no gating logic changes.

---

## Technical notes

- All work is Tailwind + React. No new deps.
- Breakpoints: default Tailwind (`sm 640`, `md 768`, `lg 1024`, `xl 1280`). 320/375/390/414 all fall under default mobile-first base styles.
- Verification per phase: visual check at 320/375/768/1024/1440 via preview viewport tool + targeted `code--view` on the touched files.
- Mobile terminal swap uses existing `useIsMobile()` hook; no new media-query infra.

---

## Deliverable order

Phase 1 → verify → Phase 2 → verify → Phase 3 → verify → Phase 4 + Mobile QA report tile.

Shall I proceed starting with **Phase 1 (global overflow + public site nav/pages)**?
