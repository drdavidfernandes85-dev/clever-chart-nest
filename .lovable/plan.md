# Account-Route Identity Verification & Catalogue Quarantine

## Problem
The Broker Symbols module synced 364 rows from TL accountId `559a12e4…bcfe`, but the connected MT5 account is login `87943580` / server `InfinoxLimited-MT5Live` whose real symbols carry `+` suffixes. The synced catalogue has no `+` symbols, proving the route is wrong (or at least unverified) for this user. The other candidate `29008868…2007` (the traderId) is more likely the executable route per TL OpenAPI, but must be confirmed remotely.

No live orders, no weakening of risk/coordinator/kill-switch gates.

## Part A — Schema additions

Migration on `user_mt_accounts`:
- `account_route_verified boolean default false`
- `account_route_verified_at timestamptz`
- `account_route_mt5_login text`
- `account_route_mt5_server text`
- `account_route_verification_evidence jsonb`
- `trading_layer_account_route_id text` (the route confirmed to belong to this MT5 login/server)

Migration on `broker_symbol_catalog`:
- `execution_usable boolean default false`
- `route_identity_verified boolean default false`
- `source_account_route_id text`
- `notes text`

Quarantine existing rows (data update): all rows sourced from `559a12e4…bcfe` → `execution_usable=false`, `route_identity_verified=false`, `mapping_status='route_unverified_or_wrong_account'`, with notes string.

## Part B — New edge function `verify-trading-layer-account-route`

Admin/owner only. Inputs: `localMtAccountId` (admin can pass `targetUserId`).
- Resolve expected MT5 `login`/`server` from `user_mt_accounts` row.
- For each candidate in `[trading_layer_trader_id, trading_layer_account_id]` (dedup), call `GET /api/v1/accounts/{id}` via `tlClient`.
- Return per candidate: HTTP status, returned `login`, `server`, `currency`, `company`, `trade_allowed`, `trade_mode` raw+label, `identityMatchesExpectedLogin`, `identityMatchesExpectedServer`.
- If exactly one candidate matches both login and server → persist as verified: set `account_route_verified=true`, `account_route_verified_at=now()`, `trading_layer_account_route_id=<that id>`, `account_route_mt5_login/server`, `account_route_verification_evidence=<sanitized response>`.
- If none match → leave unverified, return diagnostic comparison.
- No mutations to TL. No secrets returned.

## Part C — Update `sync-broker-symbol-catalog`

- Refuse `mode:"full"` and `mode:"targeted"` unless `account_route_verified=true`. Return `{error:"ACCOUNT_ROUTE_UNVERIFIED"}` with the comparison hint.
- Use `trading_layer_account_route_id` (verified) — never raw `trading_layer_account_id`.
- Stamp inserted rows: `source_account_route_id`, `route_identity_verified=true`, `execution_usable=true` (subject to per-symbol info loading later — list mode keeps `trade_mode_raw=null` → display "Not inspected").
- `mode:"info"` still cheap; also returns `accountRouteVerified` and both candidates so UI can render the verification table.

## Part D — Targeted EURUSD/XAUUSD symbol-info

Extend sync function (or new small endpoint `get-broker-symbol-info`):
- For a specific exact `brokerSymbol`, call `GET /api/v1/accounts/{verifiedId}/symbols/{encodeURIComponent(symbol)}`.
- Persist full metadata into the catalogue row (`trade_mode_raw`, `trade_mode_interpretation`, `volume_min/max/step`, `digits`, `contract_size`, `raw_metadata`).
- Used by admin "Inspect symbol" action.

## Part E — Shared resolver gate (`_shared/brokerSymbol.ts`)

Tighten `resolveExecutionBrokerSymbol()` to require:
- `account_route_verified=true` on the user's MT row.
- catalogue row `route_identity_verified=true` AND `source_account_route_id === user_mt_accounts.trading_layer_account_route_id`.
- exact brokerSymbol present, `trade_mode_raw` loaded.
- `account.trade_allowed=true` and direction permitted by both account trade_mode and symbol trade_mode.

Emits explicit failure codes: `ACCOUNT_ROUTE_UNVERIFIED`, `BROKER_SYMBOL_CATALOGUE_WRONG_ACCOUNT`, `BROKER_SYMBOL_UNRESOLVED`, `SYMBOL_METADATA_NOT_LOADED`, `ACCOUNT_TRADE_NOT_ALLOWED`, `BUY_NOT_ALLOWED_BY_TRADE_MODE`, `SELL_NOT_ALLOWED_BY_TRADE_MODE`.

No changes to risk/fresh-tick/kill-switch/coordinator beyond consuming these new codes.

## Part F — Admin Broker Symbols UI

New section above "Account Execution Permission":

```text
Trading Layer Route Verification
| Candidate     | ID Mask  | Login | Server | MT5 Match | Use for Exec |
| Trader route  | 290…007  | ...   | ...    | yes/no    | yes/no       |
| Stored route  | 559…cfe  | ...   | ...    | yes/no    | yes/no       |
[Verify Account Route]
```

While not verified:
- Permission card → "unverified"; catalogue → "unusable for execution"; readiness → NO with blocker copy.
- All live-test buttons disabled.

After verification:
- Use verified route for Refresh Permission, Sync Full, Targeted EURUSD/XAUUSD.
- Show per-side readiness "EURUSD BUY ready: yes/no", "EURUSD SELL ready: yes/no".
- Catalogue rows without inspected metadata render "Not inspected" rather than "Not eligible".

## Part G — Read-only verification run (Part 10)

After deploy, call `verify-trading-layer-account-route` then (only if verified) run targeted EURUSD/XAUUSD sync and per-symbol info. Report results — no live orders.

## Files

- `supabase/migrations/<new>.sql` — schema + quarantine UPDATE
- `supabase/functions/verify-trading-layer-account-route/index.ts` — NEW
- `supabase/functions/sync-broker-symbol-catalog/index.ts` — gate by verified route, stamp new columns, add per-symbol info
- `supabase/functions/_shared/brokerSymbol.ts` — tighten resolver, add failure codes
- `src/components/admin/AdminBrokerSymbolsTab.tsx` — verification UI + new readiness + per-symbol inspect

## Out of scope
- No live trades.
- No changes to risk caps, kill switch, fresh-tick, coordinator, exact-broker-symbol gate semantics (only stricter inputs).
- No deletion of quarantined rows.
