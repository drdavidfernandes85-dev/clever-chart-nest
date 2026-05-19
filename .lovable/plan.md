# Compliance Cleanup for Broker Approval

This is a large multi-area task. Before I start touching ~50+ files, I want to confirm scope and a few key decisions so the result actually passes Compliance review.

## What I will do

### 1. Branding & attribution
- Add a small `PoweredByTradingLayer` component (logo + text) and place it in:
  - Trading room header / footer
  - Ideas tab header
  - Copy / Follow panels
  - Execution confirmation modals
- Remove any "Powered by INFINOX" or broker-as-operator wording in the trading room.
- Add neutral wording: "The broker provides the MT5 trading account connection only…"

### 2. Rename Signals → Ideas (frontend only)
- Global search/replace in user-facing strings only:
  - Routes: `/signals` → `/ideas` (with redirect from old route)
  - Files: `TradingSignals.tsx` → `TradingIdeas.tsx`, `NewSignalForm.tsx` → `NewIdeaForm.tsx`, `SymbolIntelligence` "Trade Ideas" already OK
  - Navbar, MobileBottomNav, Dashboard tabs, toasts, modal titles, button labels
  - i18n translation files (EN/ES/PT)
- Backend tables (`trading_signals`), edge functions (`execute-signal`), and DB columns stay — no user sees them. Internal variable names stay.

### 3. Combine Trade Ideas + Copy Trading into single "Ideas" tab
- New page `/ideas` with two sections: "Trade Ideas" and "Follow / Copy Tools"
- Old `/copy-trading` and `/signals` redirect to `/ideas`
- Top-of-page compliance disclaimer block

### 4. Remove risky wording
- Scan all user-facing files for: guaranteed, risk-free, sure trade, best signal, expert signal, copy our trades, automatic profits, financial advice, investment recommendation, broker signals, INFINOX copy trading, etc.
- Replace with the approved compliant phrases.

### 5. Global risk footer
- Add `ComplianceFooter` component, render in `Footer.tsx` and inside the dashboard shell so it appears on every authenticated page too.

### 6. Ideas tab disclaimer
- Persistent banner at top of `/ideas`.

### 7. Copy / Follow confirmation checkbox
- Add a required checkbox in `CopyTradeModal` and any "Execute Idea" / "Use This Idea" flow.
- Rename buttons: Take/Copy/Follow Signal → Review Idea / Execute Idea / Use This Idea.

### 8. First-visit trading room disclaimer modal
- `TradingRoomDisclaimerModal` shown once, persisted in localStorage key `trading-room-disclaimer-ack-v1`.
- Triggered on first visit to `/dashboard` (and `/ideas`).

### 9. `/terms` page — full Terms & Conditions with all 16 sections listed.

### 10. `/risk-disclosure` page — all 10 sections.

### 11. Privacy / data note
- Short component embedded in `/connect-mt` and `/terms`.

### 12. Broker separation wording
- Add to Terms, Risk Disclosure, Ideas tab footer, Connect-MT page.

### 13. Header/footer labels
- "Powered by Trading Layer" badge in dashboard header.
- Remove broker-implying wording.

### 14. Execution safety wording
- Add confirmation text in `BlackArrowTradePanel` open flow and `PositionActions` close flow (above the existing button or in an AlertDialog).

### 15. Compliance review checklist page
- `/compliance-review` (admin or dev-mode visible) showing all 16 items with status indicators.

### 16. Final UI scan
- Run `rg` for the banned terms after edits and report results.

## Technical notes
- Logo: I'll need the Trading Layer logo file. **You mentioned an attached logo but I don't see an attachment in this message.** I'll create a placeholder text-only "Powered by Trading Layer" badge for now using the existing yellow brand token, and swap in the real SVG/PNG as soon as you upload it.
- i18n: I'll update EN strings and mirror to ES/PT where existing keys exist; new compliance copy will be added to all three locales.
- Routes added: `/ideas`, `/terms`, `/risk-disclosure`, `/compliance-review`. Old `/signals` and `/copy-trading` will 301-redirect via `<Navigate>` to `/ideas`.
- DB: no migrations needed. All rename work is UI-only. `trading_signals` table keeps its name.
- Files touched (estimate): ~40 files (new pages, new components, navbar, footer, dashboard tabs, copy trade modal, trade panel, i18n).

## Confirm before I start

1. **Trading Layer logo** — please attach it, or confirm I should ship a text-only "Powered by Trading Layer" badge and you'll drop the logo in later.
2. **Broker name in disclaimers** — should I write "INFINOX" explicitly, or keep it generic as "the broker"? Compliance text above uses "the broker", I'll follow that unless you say otherwise.
3. **Route redirects** — OK to keep `/signals` and `/copy-trading` as redirects (so old links work), or do you want them returning 404?
4. **First-visit modal scope** — trigger on `/dashboard` only, or any authenticated trading-room route?
