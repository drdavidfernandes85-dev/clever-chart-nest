## Goal

Replace inferred execution eligibility with **explicit Trading Layer `account.trade_mode` and `symbol.trade_mode` checks**, and force all real MT5 execution to use the **exact broker symbol** (e.g. `XAUUSD+`) returned by Trading Layer instead of the canonical/display symbol. No live order will be submitted during this pass.

## Scope guardrails (unchanged)

Risk validation, kill switch, admin-only execution gate, max testing limits, fresh-tick requirement, WebSocket market-data architecture, trader mapping resolver, confirmation coordinator, no-fake-success rule, and the disabled client live execution all remain untouched.

---

## Part A — Backend: trade-mode + broker-symbol catalogue

1. **New edge function `get-trading-execution-eligibility`**
   - Authenticated; resolves active validated mapping (traderId, login, server).
   - Server-side calls:
     - `GET /api/v1/traders/{traderId}` → `account.trade_mode`
     - `GET /api/v1/accounts/{traderId}/symbols` → per-symbol `trade_mode`, exact broker symbol, digits, contract size, description.
   - Upserts the symbol list into `broker_symbol_catalog` (see below).
   - Returns sanitized JSON only: `accountTradeMode`, `accountTradeEligible`, `displaySymbol`, `brokerSymbol`, `symbolTradeMode`, `symbolTradeEligible`, `eligibility` (eligible|blocked|unknown), `blockedReason`, `checkedAt`. Never returns API keys, MT5 passwords, or auth headers.

2. **New table `broker_symbol_catalog`** (migration)
   - Columns: id, trading_layer_trader_id, mt5_login, mt5_server, display_symbol, canonical_symbol, broker_symbol, description, asset_class, digits, contract_size, trade_mode, trade_eligible, source (`trading_layer_symbols`), last_synced_at, raw_metadata, created_at, updated_at.
   - Unique on (trading_layer_trader_id, broker_symbol).
   - RLS: admins manage; authenticated users select rows that match their own mapping.

3. **Persist mapping fields on execution evidence** in `admin_live_execution_tests`, `execution_audit_events`, `trade_execution_logs`:
   - `display_symbol`, `broker_symbol`, `symbol_trade_mode`, `account_trade_mode`, `symbol_mapping_source`, `symbol_mapping_checked_at` (stored inside existing `evidence_json` / `sync_meta` / `request_payload` jsonb to avoid schema churn on hot tables).

## Part B — Execution path hard gates

Update `submit-best-execution-order`, `execute-trade`, `submit-pending-order`, `cancel-pending-order`, `close-position-controlled`, `modify-position-protection`, `reconcile-execution` to:

- Call the eligibility resolver (or read fresh catalogue row) before any transport.
- Submit `brokerSymbol` to Trading Layer, never `displaySymbol`/`canonicalSymbol` when they differ.
- Pre-submission classifications (no broker call, no coordinator, no pass/fail):
  - `account_trade_mode_blocked`
  - `symbol_trade_mode_blocked`
  - `broker_symbol_unresolved`
  - `broker_symbol_mapping_stale`
- Fresh-tick + risk validation use `brokerSymbol` where the live price source supports it; record both symbols in audit.

## Part C — Reconciliation

- Primary match: exact `brokerSymbol`.
- Fallbacks: ticket → orderId → dealId → canonical/suffix normalisation.
- Record `match_mode` (`exact_broker_symbol | ticket | orderId | dealId | suffix_fallback`).

## Part D — Order Ticket UI (`BlackArrowTradePanel`)

In `admin_live_test` mode add an **Execution Permission** block:
- Instrument: displaySymbol
- Broker symbol: brokerSymbol (only when returned)
- Account trade mode / Symbol trade mode / Execution eligibility chip (READY / BLOCKED / UNKNOWN)
- Session source: `Trading Layer trade_mode`
- Separate **Market data** row keeps tick age — copy clarifies that live ticks ≠ trading permission.
- Buy/Sell disabled unless `eligibility = eligible`.

## Part E — Admin Production panel

Add "Trading Execution Eligibility" card:
- account.trade_mode + last sync
- broker-symbol catalogue last sync
- XAUUSD and EURUSD rows: display → broker → trade_mode
- Execution blocker reason
- "Ready for broker-symbol verified test" yes/no
- Manual "Refresh eligibility" button (calls the new edge function)
- Live test matrix splits pre-fix rejected attempts from post-fix verification.

## Part F — Data reclassification (no deletion)

Update the two prior failed rows (`c6828ad8` EURUSD, `b9a9c292` XAUUSD) via insert tool:
- `confirmation_status = order_rejected_trade_disabled_before_broker_symbol_fix`
- Notes describe pre-fix submission; retest required with exact brokerSymbol after trade_mode confirmation.
- Site setting `execution_permission_status` annotated: blocker reason now `awaiting_broker_symbol_verified_retest`.

## Part G — Read-only verification (Part 10)

After deploy, call `get-trading-execution-eligibility` once for trader `29008868-d583-4ab5-a6c1-57586fe92007` for both EURUSD and XAUUSD and report:
- account.trade_mode
- per-symbol display → brokerSymbol → trade_mode
- eligibility + reason

**No live order is submitted during this pass.** Stage A retest is left for the user to trigger only after the read-only report shows account + EURUSD broker symbol explicitly eligible.

---

## Technical notes

- Schema migration creates only `broker_symbol_catalog`; existing execution evidence tables get new fields inside their existing jsonb columns to avoid risky alterations.
- Edge function uses `TRADING_LAYER_API_KEY` secret; sanitizes responses before returning.
- All UI tokens go through existing semantic CSS variables; no hardcoded colors.
- Translations: English copy only (matches existing admin/tester UI).

Files to add/edit:
- `supabase/migrations/<new>.sql` — `broker_symbol_catalog` + RLS
- `supabase/functions/get-trading-execution-eligibility/index.ts` — new
- `supabase/functions/submit-best-execution-order/index.ts` — gates + brokerSymbol
- `supabase/functions/execute-trade/index.ts` — gates + brokerSymbol
- `supabase/functions/submit-pending-order/index.ts`, `cancel-pending-order/index.ts`, `close-position-controlled/index.ts`, `modify-position-protection/index.ts`, `reconcile-execution/index.ts` — brokerSymbol usage + match_mode
- `src/lib/executionEligibility.ts` — new client helper
- `src/components/dashboard/BlackArrowTradePanel.tsx` — UI block + gate
- `src/components/admin/AdminProductionModeTab.tsx` — eligibility card + refresh
- `src/lib/productionMode.ts` — extend permission state with eligibility snapshot
- Data updates via `supabase--insert` for the two test rows + `site_settings`.

Acceptance: Critical/High/Medium = 0 after static verification; ordinary users still blocked; no live order placed.
