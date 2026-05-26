## Account-Specific Broker Symbol Resolution — Implementation Plan

This is a large, multi-file refactor of the symbol-resolution and execution pipeline. Below is the concrete plan I will execute before placing any live order.

### Scope summary

Every live trading mutation (market order, close, partial close, SL/TP, pending placement/cancel) must submit the **exact `brokerSymbol`** returned by Trading Layer for the **specific connected MT5 account** of the acting user. No suffix is hardcoded, no canonical/display value is ever sent, and no mapping is ever shared across users or accounts.

---

### Phase 1 — Data model (DB migration)

Extend `broker_symbol_catalog`:
- Add: `user_id`, `local_mt_account_id`, `mt5_login`, `mt5_server`, `chart_symbol`, `volume_min`, `volume_max`, `volume_step`, `trade_mode_raw`, `trade_mode_interpretation`, `catalogue_complete`, `stale_at`, `checked_at`
- Drop old unique constraint, add new unique `(trading_layer_account_id, broker_symbol)`
- Tighten RLS: users may read only rows where `user_id = auth.uid()`; admin/service-role manages writes

No data deletion — existing rows reclassified as `source_verified=false`, `catalogue_complete=false`.

### Phase 2 — Account-scoped catalogue sync

New shared module `supabase/functions/_shared/symbolCatalogue.ts`:
- `syncAccountCatalogue({ userId, traderId, accountId, login, server })`
- Calls `GET /api/v1/accounts/{trading_layer_account_id}/symbols` with full pagination (offset + cursor, page=500, hard cap)
- Stores raw broker symbol untouched
- Derives `canonical_symbol` and `display_symbol` via a deterministic `canonicaliseBrokerSymbol()` (strips only registered known suffixes: `+`, `.m`, `.pro`, `.cash`, `.a`, `.crp` — never blindly)
- Sets `catalogue_complete=true` only when last page returns < pageSize OR cursor is null
- Invoked from `connect-mt5-v2` and `sync-mt-account` on successful (re)connect

### Phase 3 — Resolver hardening (`_shared/brokerSymbol.ts`)

- `resolveEligibleBrokerSymbol` now scoped by `trading_layer_account_id`, not trader
- Returns `ambiguous` status when multiple variants match the requested display symbol — execution blocked, admin must select default
- Position/pending actions: prefer `suppliedBrokerSymbol` from the live MT5 record over catalogue derivation
- Adds `recoverPositionBrokerSymbol(ticket)` that re-reads the MT5 position to recover the exact broker symbol when missing

### Phase 4 — Mutation paths

Update every execution edge function to:
1. Require `mapping.tradingLayerAccountId`
2. Resolve `brokerSymbol` via account-scoped resolver
3. Send `symbol: brokerSymbol` exactly to Trading Layer
4. Audit `displaySymbol`, `canonicalSymbol`, `brokerSymbol`, `tradingLayerAccountId`, `symbolMappingCheckedAt`, `symbolMappingSource`, `accountTradeModeRaw`, `symbolTradeModeRaw`

Files: `execute-trade`, `submit-best-execution-order`, `submit-pending-order`, `cancel-pending-order`, `close-position-controlled`, `modify-position-protection`, `reconcile-execution`.

### Phase 5 — Position/pending records

Migration: ensure `mt_positions` and `mt_pending_orders` have `broker_symbol` (nullable for legacy). Sync paths persist exact broker symbol from MT5. UI disables Close/Modify/Cancel when `broker_symbol` is null and recovery fails.

### Phase 6 — Frontend

- `BrokerSymbolsContext`: load catalogue scoped to active `trading_layer_account_id`; expose `{ displaySymbol, canonicalSymbol, chartSymbol, brokerSymbol, variants[] }`
- `BlackArrowTradePanel`, `PendingOrderModal`, `PositionActions`, `PendingOrdersPanel`: include `brokerSymbol` (and full identity quad) in every mutation payload; disable action when unresolved/ambiguous with clear message
- Account switching invalidates the cached catalogue

### Phase 7 — Admin Eligibility card

`AdminExecutionEligibilityCard.tsx`: show masked traderId + accountId, catalogue completeness + last sync, account trade_mode raw+interpretation, per-symbol (EURUSD, XAUUSD) variants table with broker symbol, raw trade_mode, ambiguity flag, readiness verdict, and a **Refresh Catalogue** button (read-only — never submits an order).

### Phase 8 — Read-only verification

After deployment, call `get-trading-execution-eligibility` (read-only) for the admin tester account and report:
- pagination handled (yes/no, pages fetched, total symbols)
- exact EURUSD brokerSymbol(s)
- exact XAUUSD brokerSymbol(s)
- mix of suffixed and unsuffixed examples
- raw account + symbol `trade_mode`
- whether enum meaning is confirmed (no — awaiting TL)
- whether all mutation paths use exact brokerSymbol (code-level audit)
- next live test → **blocked** until TL confirms enum + ambiguity resolved

---

### Guardrails preserved

- No live order submitted in this pass
- Kill switch / risk / fresh-tick / coordinator unchanged
- Ordinary users remain execution-blocked (admin_live_test mode gate)
- No secrets exposed; no client-side credential storage
- RLS tightened, never loosened

### Technical notes

- Canonicalisation suffix list is configurable in `site_settings.broker_symbol_suffixes` (default `["+", ".m", ".pro", ".cash", ".a", ".crp", ".raw", ".ecn"]`) — never hardcoded in TS
- Ambiguity resolution stored in `site_settings.broker_symbol_defaults[trading_layer_account_id][canonical_symbol] = broker_symbol`
- `submit-best-execution-order` & `execute-trade` early-return `400 brokerSymbolAmbiguous` when multiple variants and no admin default

After your approval I will run this end-to-end and return the read-only verification report — no live orders.
