# Broker-Symbol Final Resolution Fix

No live orders, no pending-order activation, no risk/kill-switch/coordinator changes. Read-only verification + UI/state/persistence corrections + backend resolver hardening.

## Scope by file

### Frontend — `src/components/admin/AdminBrokerSymbolsTab.tsx`
- **Readiness Summary**: derive EURUSD/XAUUSD readiness from the *targeted inspected results* state, not from the visible-filtered bulk catalogue list.
  - EURUSD: 1 LIST/SEARCH candidate (`EURUSD`) + inspected metadata `trade_mode=FULL` + route verified + `trade_allowed=true` → `resolution_status=resolved_unique_verified`, `metadata_status=inspected`, BUY/SELL/CLOSE eligible at symbol level.
  - XAUUSD: multiple LIST/SEARCH variants (`XAUUSD`, `XAUUSD.m` both FULL; `XAUUSD.crp` DISABLED) → `resolution_status=ambiguous_multiple_executable_variants`, execution_usable=false, BUY/SELL ready=no with the “Multiple executable broker symbols match XAUUSD…” message.
- **Probe table**: replace `preserved yes/no` with columns `Requested | Returned | Exact Request Match | Interpretation`. EURUSD+/XAUUSD+ rows interpreted as "Alias resolved to base; X+ not proven to exist". Drop the “storage preservation bug” framing.
- **Catalogue row labels**:
  - `Trade Mode = Not inspected` → `Metadata Status: Not inspected`
  - `Exec Usable = no` (when not inspected) → `Execution Status: Not evaluated`
  - Disabled only when symbol-info returns `SYMBOL_TRADE_MODE_DISABLED`; Eligible / Ambiguous / Quarantined per rules.
- **Buttons**:
  - Rename existing `Sync Full Visible Catalogue` → `Sync Visible Market Watch` (still uses `visible=true`, marked UI-only, never authoritative).
  - Add new `Sync Full Execution Catalogue` button calling sync with `visible` filter off (authoritative for execution discovery).
- **Discrepancy acknowledgement gate** (admin-only, persisted in `site_settings` under `broker_symbol_acknowledgements.eurusd_mt5_suffix_discrepancy`): checkbox “I acknowledge that Trading Layer returned `EURUSD` as the exact executable broker symbol for this verified route, despite the MT5 suffix display discrepancy.” Without ack: `Ready for controlled EURUSD test = no`, blocker text as specified. With ack: BUY/SELL ready = yes (still subject to other gates).
- **EURUSD diagnostic banner**: retained warning text re: MT5 terminal suffix mismatch.
- **Sanitized evidence export**: “Export Trading Layer Evidence” button that downloads a JSON/MD report with route, MT5 login/server, account trade_allowed, search/probe matrix for EURUSD/XAUUSD and the question for TL. Strips all auth headers / keys.

### Edge function — `supabase/functions/sync-broker-symbol-catalog/index.ts`
- Accept a `mode` param: `visible_market_watch` (uses `visible=true`) vs `full_execution_catalogue` (no visible filter, offset pagination).
- For `targeted` mode lookups (per-symbol): use `/symbols?search=<sym>&limit=1000&offset=0&sort=name&order=asc` with NO visible filter; store returned `visible` only as metadata.
- Distinguish: a candidate is "executable-discovered" only if it appears in LIST/SEARCH raw results. Never insert/mark an alias-requested symbol as execution-usable from direct `/symbols/{name}` alone — record it as `alias_probe_only`.
- When inserting/updating `broker_symbol_catalog` rows for an inspected EURUSD targeted hit on the verified route, persist:
  `broker_symbol=EURUSD`, `display_symbol=EURUSD`, `canonical_symbol=EURUSD`, `source_account_route_id=<route>`, `route_identity_verified=true`, `execution_usable=true`, `metadata_inspected=true` (via `raw_metadata.metadata_inspected`), `trade_mode_raw='4'`, `trade_mode_interpretation='SYMBOL_TRADE_MODE_FULL'`, `trade_eligible=true`, `checked_at=now()`. BUY/SELL/CLOSE eligibility stored inside `raw_metadata` (no schema change).

### Edge function — `supabase/functions/_shared/brokerSymbol.ts` (shared resolver)
- Add `resolveExecutionBrokerSymbol(userId, canonical)` that requires ALL of:
  - verified active route id
  - account `trade_allowed=true` (fresh check)
  - candidate originated from LIST/SEARCH (not alias-probe-only)
  - exact symbol-info inspected fresh, `trade_mode` permits requested side
  - unique resolution
  - for EURUSD specifically: discrepancy ack recorded in `site_settings`
- Returns explicit error codes:
  - `BROKER_SYMBOL_AMBIGUOUS_MULTIPLE_EXECUTABLE_VARIANTS` for XAUUSD
  - `BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED` for EURUSD without ack
  - `BROKER_SYMBOL_NOT_LIST_DISCOVERED` for alias-only matches
- Never strip/append `+`; never use canonical as fallback when ambiguous.

### Mutation gates
- `execute-trade`, `execute-signal`, `submit-best-execution-order`, `submit-pending-order`, `close-position-controlled`, `modify-position-protection`, `cancel-pending-order`: call the shared resolver before any TL mutation; surface the explicit error codes; no behaviour change to risk / fresh-tick / kill-switch / coordinator.

### Data — historical rejection note
- Update prior EURUSD rejected `trade_execution_logs` rows (single `UPDATE` via insert tool) only for:
  - `classification = 'order_rejected_before_verified_route_and_exact_symbol_resolution'`
  - prepended note text as specified
- No deletion, no flipping to pass.

## Out of scope
- No `+` symbol invention.
- No live order, no pending-orders enablement, no limit raises.
- No changes to risk engine, fresh-tick logic, kill-switch, execution coordinator.
- No new tables (gate state stored in `site_settings` to avoid migration churn).

## Verification (Part 11 report)
After applying, response will answer the 12-item checklist with concrete yes/no plus the file/edge-function evidence.
