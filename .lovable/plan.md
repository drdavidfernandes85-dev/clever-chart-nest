# Execution speed + MT5 confirmation fix

This is a cross-cutting fix across the order-entry frontend and ~12 Edge Functions. It does **not** change compliance copy, risk validation, kill switch, fresh tick validation, or mobile read-only behavior.

## What we will change

### 1. `submit-best-execution-order` (backend)
- Add a `timings` collector (`requestReceivedAt`, `authValidatedAt`, `accountResolvedAt`, `riskValidatedAt`, `freshTickFetchedAt`, `orderSentToTradingLayerAt`, `tradingLayerResponseAt`, `firstReconcileStartedAt`, `mt5ConfirmedAt`, `finalUiStatusAt`), returned only when `devMode=true` in the body.
- Parse the raw Trading Layer response and persist: `retcode, retcodeName, retcodeDescription, orderId, dealId, positionId/ticket, requestId, clientOrderId, symbol, side, volume, price, brokerResponseTimeMs` into `trade_execution_logs.response_payload` and surface IDs in the function's JSON response.
- Return early to the client as soon as TL responds with `broker_accepted` (status: `broker_accepted_pending_confirmation`) carrying all IDs. Audit insert moves to a fire-and-forget after the response is constructed.
- Resolve `metaapi_account_id` (which equals `trading_layer_trader_id`) **once per request**; never use local row UUID as TL accountId. Add a defensive check that rejects with `TL_MAPPING_INVALID` if mapping looks like a stale ownerAccountId pattern.

### 2. New `reconcile-execution` cadence
- Client-driven cadence: 0, 500ms, 1s, 2s, 3.5s, 5s, 8s, 12s, 15s. Stops early on first confirmation.
- Each attempt runs **positions + orders + deals** queries in parallel against the resolved traderId.
- Match priority: positionTicket/ticket → dealId → orderId → requestId/clientOrderId → brokerSymbol+side+volume+account within recent time window. Symbol comparison is suffix-tolerant (`XAUUSD` matches `XAUUSD.M`). Entry price is not required.
- Returns one of: `position_confirmed`, `order_found_not_filled`, `pending_order_placed`, `unconfirmed_after_reconciliation`, `rejected`, `cancelled` plus the `sourcesChecked` map.

### 3. Frontend order ticket state machine (`src/components/dashboard/BlackArrowTradePanel.tsx` and the execute helper)
- On click: instantly show `Sending order…`.
- On TL `broker_accepted` response: instantly show `Broker accepted — waiting for MT5 confirmation.`
- On reject: `Order rejected by broker.`
- On risk/validation block: `Order blocked by risk controls.`
- Background reconciliation loop using the new cadence; updates UI as soon as a non-pending status arrives.
- Optimistic states allowed: `sending_order`, `broker_accepted`, `waiting_mt5_confirmation`, `close_request_sent`, `close_broker_accepted`. Never optimistic for `executed` / `position_opened` / `position_closed`.
- Final fallback copy after full cadence: `Order accepted, but MT5 confirmation was not found yet. Please check MT5 or retry confirmation.`

### 4. `close-position-controlled` + close modal
- Modal pre-flight validation: requires `positionTicket`, `brokerSymbol`, `volume>0`, `side`, resolved `traderId`. Bails with a clear inline error otherwise.
- Payload uses positionTicket + exact broker symbol + exact (or partial) volume + side + traderId. Never closes by symbol only, never uses display symbol if a different broker symbol exists, never sends local row id.
- Same reconciliation cadence as open (0/500/1s/2s/3.5s/5s/8s/12s), parallel checks, success when position removed or volume reduced (partial).
- Same instant UI transitions: `Close request sent` → `Broker accepted close request` → terminal status.

### 5. Account-ID audit pass across edge functions
Verify and fix where needed (read-only review, surgical edits only):
- `submit-best-execution-order`, `execute-trade`, `close-position-controlled`, `modify-position-protection`, `reconcile-execution`, `get-live-account`, `get-mt5-terminal-data`, `get-mt5-quotes`, `get-mt5-market-watch`, `get-mt5-symbol-data`, `get-trading-symbols`, `tl-market-data-stream`.
- All must read `metaapi_account_id` from `user_mt_accounts` (single source of truth post connect-mt5-v2). Any path that synthesizes an ID from a local UUID or tenant ownerAccount is removed.

### 6. Performance
- Frontend preloads account mapping on terminal mount (TanStack-style cache) and reuses it for the whole reconciliation lifecycle.
- Broker symbol metadata cached client-side per session.
- Edge functions skip redundant account lookups inside reconcile attempts by accepting `traderId` from the client (validated server-side against the user's row).
- Audit writes use `EdgeRuntime.waitUntil` so they never block the response.

### 7. Dev diagnostics panel
- Extend the existing `ExecutionReconciliationDebugPanel` (Dev Mode only) to show: tradeId/clientOrderId, transport, accountId used, local row id, trading_layer_trader_id, brokerSymbol, displaySymbol, side, volume, risk validation result, fresh tick age, retcode/Name/Description, orderId, dealId, positionTicket, attempt count, sourcesChecked map, final confirmationStatus, full timing breakdown. No secrets, no API key, no MT5 password.

## What stays untouched
- Compliance and disclaimer wording.
- Backend risk validation order (still runs before order send).
- Kill switch behavior and testing-mode limits.
- Fresh tick validation (still required before send).
- Mobile read-only strategy.
- RLS / auth / secrets handling.

## Out of scope (will note but not change)
- Database schema (existing columns on `trade_execution_logs` cover everything we need).
- `connect-mt5-v2` (already the single writer of TL IDs).
- WebSocket market data pipeline.

## Risk notes
- Moving audit writes off the response path means a crash could miss an audit row; we keep the synchronous insert when `outcome=rejected` or `risk_blocked`. Confirmed/pending audits stay async.
- Symbol-suffix tolerance is fallback-only; primary match still uses exact broker symbol returned by TL.

If this looks right, approve and I'll implement in this order: backend (`submit-best-execution-order` → `reconcile-execution` → `close-position-controlled` → audit pass) → frontend state machine + close modal → Dev diagnostics panel.
