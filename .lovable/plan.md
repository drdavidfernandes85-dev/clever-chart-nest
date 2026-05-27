## Controlled retest preparation — EURUSD SELL 0.01

Scope: Parts 1–6. No automatic mutation. No platform close/cancel/modify. Risk/fresh-tick/kill-switch/idempotency/coordinator unchanged.

### Part 1 — Record manual closure (DB only)
Update `site_settings.trading_layer_direct_external_test_1169085428`:
- `externalPositionManuallyClosedByUser = true`
- `externalPositionClosedConfirmedAt = now()`
- `closureSource = "user_confirmed_native_mt5_manual_close"`
- `residualExposureVerificationRequired = true`

Read-only exposure verification is performed live by `validate-full-pretrade` (open positions / pending orders) when the preview runs in Part 4 — verification result is reflected back into the diagnostic record by the new `controlled-retest-authorise` edge function on first preview pass, flipping `residualExposureVerificationRequired` to `false` only when none remain. No platform close/cancel calls are issued.

### Part 2 — Blocker becomes one-time retest gate
New (or upsert) `site_settings.final_activation_blocker`:
```
{
  active: true,
  status: "controlled_retest_pending_authorisation",
  block_reason_code: "MINIMAL_TL_DTO_FIX_REQUIRES_SINGLE_VALIDATION_TEST",
  general_buy_sell_disabled: true,
  client_live_execution_disabled: true,
  pending_orders_disabled: true,
  display_copy: "<exact copy from spec>"
}
```
Client trading components (`BlackArrowTradePanel`, `PendingOrderModal`, `FloatingQuickTrade`) already read execution eligibility from `useTerminalExecutionEligibility` — we surface the blocker copy via a new lightweight hook `useFinalActivationBlocker` that reads `final_activation_blocker` and forces BUY/SELL/pending disabled regardless of per-symbol eligibility. Pending orders modal gets the same gate.

### Part 3 — One-time controlled retest authorisation

New table `controlled_retest_authorisations` (auth-only, admin-managed):
```
id uuid pk
authorised_by uuid
authorised_at timestamptz
permitted_symbol text         -- 'EURUSD'
permitted_broker_symbol text  -- 'EURUSD'
permitted_side text           -- 'sell'
permitted_volume numeric      -- 0.01
permitted_route_account_id text -- '559a12e4-...'
permitted_orders int          -- 1
expires_at timestamptz        -- now()+10min
consumed_at timestamptz null
consumed_order_id text null
outcome text null             -- 'placed' | 'rejected' | 'pretrade_blocked'
outcome_retcode int null
outcome_payload jsonb null
position_confirmed_at timestamptz null
close_confirmed_at timestamptz null
```
GRANTs to `authenticated` + `service_role`; RLS: only admins (`has_role(auth.uid(),'admin')`) can select/insert; only service_role updates outcome.

New Admin → Production action **"Authorise One Controlled EURUSD SELL Retest"** (added to `AdminProductionModeTab.tsx`) renders:
- mutation-suppressed preview block (calls `validate-full-pretrade` with `{symbol:'EURUSD', side:'sell', volume:0.01, brokerSymbol:'EURUSD'}`)
- explicit acknowledgement checklist (8 checkboxes matching spec)
- DTO preview literal: `{"side":"sell","symbol":"EURUSD","volume":0.01}`
- Authorise button → inserts row into `controlled_retest_authorisations`
- After authorisation: shows single-use **"Submit Controlled SELL 0.01"** button with 10-min countdown

### Part 4 — Mutation-suppressed preview gating
The admin card calls `validate-full-pretrade` (already exists, read-only) and renders every check. Authorise button is disabled unless every check passes. Open EURUSD positions / pending orders queried via `get-mt5-terminal-data` and shown alongside.

### Part 5 — Outcome handling
New edge function `submit-controlled-retest` (admin-only):
1. Verifies caller is admin.
2. Loads unconsumed authorisation matching `(symbol, side, volume, route)`, not expired.
3. Sets `consumed_at = now()` BEFORE dispatch (atomic single-use guard).
4. Runs the same pre-trade chain as `submit-best-execution-order` (resolver, fresh tick, risk, kill-switch, idempotency).
   - If pretrade blocks → `outcome='pretrade_blocked'`, no dispatch, blocker stays as `controlled_retest_pending_authorisation` (no broker test consumed); admin may re-authorise after fixing.
5. Dispatches strict minimal DTO `{"side":"sell","symbol":"EURUSD","volume":0.01}` to `/api/v1/accounts/{route}/trades/send`.
6. On `retcode=10008` → `outcome='placed'`, store orderId, wait for `position_confirmed` via existing reconciliation coordinator → flips `final_activation_blocker` to `controlled_retest_position_confirmed_close_only`. Client BUY/SELL/pending remain disabled. UI exposes Close-only on that exact position id.
7. On `retcode=10017` → `outcome='rejected'`, set `final_activation_blocker.block_reason_code = 'BROKER_REJECTED_MINIMAL_DTO_TRADE_DISABLED'`, persist literal outbound DTO + response. No retry permitted.

Close lifecycle (post-confirmation): existing `close-position-controlled` is gated by a new server check ensuring it targets only `authorisation.consumed_order_id`. After `close_confirmed`, blocker moves to `controlled_retest_close_confirmed_pending_final_report`.

### Files to add / edit

**Edge functions (new)**
- `supabase/functions/submit-controlled-retest/index.ts`
- `supabase/functions/_shared/finalActivationBlocker.ts` (helpers to read/update blocker)

**Edge functions (edit)**
- `supabase/functions/close-position-controlled/index.ts` — when blocker is in controlled-retest mode, only allow `consumed_order_id`.
- `supabase/functions/execute-trade/index.ts` & `submit-best-execution-order/index.ts` — read `final_activation_blocker`; reject mutations unless caller is `submit-controlled-retest` path (internal flag).

**Frontend (new)**
- `src/hooks/useFinalActivationBlocker.ts`
- `src/components/admin/AdminControlledRetestCard.tsx`

**Frontend (edit)**
- `src/components/admin/AdminProductionModeTab.tsx` — mount the new card.
- `src/components/dashboard/BlackArrowTradePanel.tsx` & `PendingOrderModal.tsx` & `FloatingQuickTrade.tsx` — render blocker copy + disable buttons when blocker active.

**DB migration**
- `controlled_retest_authorisations` table + RLS + GRANTs.
- Upsert `site_settings.final_activation_blocker`.
- Update `site_settings.trading_layer_direct_external_test_1169085428` with closure fields.

### Preparation report (Part 6, returned after build)
Will include: closure record persisted, exposure verification result, exact DTO preview, deviation absent, internal metadata excluded, one-time authorisation row exists & unconsumed, general live disabled, pending disabled, no live order submitted, no auto close/cancel/modify, no secrets exposed, safeguards unchanged.

### Out of scope
- No automatic SELL dispatch — admin must explicitly click after authorisation.
- No changes to risk/fresh-tick/kill-switch/idempotency/coordinator internals.
- No re-enable of general client execution.
