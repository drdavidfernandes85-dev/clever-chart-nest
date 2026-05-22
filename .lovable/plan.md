## Scope

Build the complete admin live testing surface for real MT5 execution from the authorised admin account (login `87943580`, trader `29008868…`) while keeping all other clients gated. This is a multi-part backend + frontend + DB effort. I want to confirm direction before writing ~15+ files.

## Approach

### 1. Database (one migration)

New table `public.admin_live_execution_tests` with the fields listed in the brief.
- RLS: SELECT/INSERT/UPDATE restricted to `has_role(auth.uid(),'admin')`. Service role bypasses RLS for backend writes from edge functions.
- New table `public.admin_live_test_limits` (single row, admin-managed) for `max_order_volume`, `max_simultaneous_test_positions`, `max_daily_live_test_orders`, `max_daily_test_loss_usd`, `pending_orders_enabled`, `partial_close_cap_increase_enabled`.
- No raw passwords/tokens/Authorization headers ever written.

### 2. Backend (edge functions)

Reuse existing `assertLiveExecutionAllowed`. Add a small shared helper `admin_live_tests.ts` that:
- creates a test row when a flow starts (called by submit/close/modify/place-pending/cancel-pending),
- patches it synchronously with TL identifiers,
- finalises it as `pass`/`fail` once the confirmation coordinator reports.

New / extended edge functions:
- `submit-best-execution-order` — already exists; add test-row write-through for `market_buy` / `market_sell`.
- `close-position-controlled` — extend for `full_close` and `partial_close` (validates `0 < closeVolume < currentVolume`, lot step) and writes test row.
- `modify-position-protection` — extend to write `modify_sl` / `modify_tp` rows, return refreshed SL/TP for verification.
- `submit-pending-order` (new) — handles BUY/SELL LIMIT/STOP with side-of-market validation against fresh tick.
- `cancel-pending-order` (new) — cancels by orderId, verifies removal.
- All gated by `assertLiveExecutionAllowed` + `admin_live_test_limits` enforcement.

Invert/reverse stays disabled at the API layer (returns `INVERT_NOT_IMPLEMENTED`).

### 3. Coordinator

Extend `executionConfirmationCoordinator` to handle these confirmation kinds:
- `position_confirmed`, `close_confirmed`, `partial_close_confirmed`, `sl_updated_confirmed`, `tp_updated_confirmed`, `pending_order_placed`, `order_cancelled_confirmed`.
Each terminal status calls a small `recordAdminLiveTestOutcome(testId, status, evidence)` helper that updates the DB row.

### 4. Admin Production panel

- Replace localStorage matrix with Supabase-backed read. Subscribe to `admin_live_execution_tests` realtime for live updates.
- “Run Verification From Audit” → calls a backend RPC `verify_admin_live_tests_from_audit` that re-derives status from `execution_audit_events` and writes verified rows. Removes manual cycle-through-status toggle.
- Add Limits sub-card editable by admin (writes to `admin_live_test_limits`).

### 5. Trade panel UI additions

- `OpenPositionsPanel` rows: `Close` (full), `Partial Close`, `SL/TP` buttons; modal flows for each.
- New `PendingOrdersPanel` with rows showing order ticket / type / entry / SL / TP / Cancel button.
- Ticket controls (BUY/SELL LIMIT/STOP) wired to `submit-pending-order` with side-of-market validation against the live quote.
- Invert button stays disabled with the tooltip from the brief.
- Admin session acknowledgement gate already exists; reuse it for all new live actions.

### 6. Ordinary-user protection

All new edge functions call `assertLiveExecutionAllowed` and return `LIVE_EXECUTION_NOT_ENABLED_FOR_USER` for non-admins. Frontend hides the new test controls behind `isAdmin && execution_mode === 'admin_live_test'`. No changes to risk/kill-switch/fresh-tick code.

## Out of scope (explicit)

- Activating `execution_mode = 'live'` for general users.
- Implementing Invert/reverse logic (stays disabled per brief).
- Touching the existing risk/kill-switch/fresh-tick modules.
- Rotating secrets (user must do manually).

## Files I will create/edit

Migration:
- `supabase/migrations/<ts>_admin_live_execution_tests.sql`

Backend:
- `supabase/functions/_shared/adminLiveTests.ts` (new)
- `supabase/functions/submit-best-execution-order/index.ts` (extend)
- `supabase/functions/close-position-controlled/index.ts` (extend — partial close)
- `supabase/functions/modify-position-protection/index.ts` (extend — test rows)
- `supabase/functions/submit-pending-order/index.ts` (new)
- `supabase/functions/cancel-pending-order/index.ts` (new)

Frontend:
- `src/services/executionConfirmationCoordinator.ts` (extend kinds + DB hook)
- `src/components/admin/AdminProductionModeTab.tsx` (DB-backed matrix + Limits card)
- `src/components/admin/AdminLiveTestLimitsCard.tsx` (new)
- `src/components/dashboard/BlackArrowTradePanel.tsx` (pending ticket wiring, invert disabled tooltip)
- `src/components/livechart/OpenPositionsPanel.tsx` (Close / Partial Close / SL-TP buttons)
- `src/components/livechart/PartialCloseModal.tsx` (new)
- `src/components/livechart/ModifySLTPModal.tsx` (new)
- `src/components/livechart/PendingOrdersPanel.tsx` (new)
- `src/lib/adminLiveTests.ts` (client helper to create/update test rows + queries)

## After implementation

I will not place any live orders myself. You will run Stage A → C from the terminal; results stream into the matrix automatically. Stage D unlocks only after Stage A passes and you raise the cap. Stage E (invert) remains intentionally disabled.

Please confirm to proceed, or tell me which parts to drop / sequence first (e.g. ship DB + Market + Close + SL/TP first, defer Pending/Cancel to a second pass).