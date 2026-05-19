## Goal

Stop every widget from polling Trading Layer on its own. Route all live prices, account, and positions through a single in-app store with controlled polling, 429 protection, and a status badge.

## Architecture

```
                     ┌──────────────────────────────┐
                     │   liveMarketDataStore        │
                     │  (single source of truth)    │
                     │   quotes / account /         │
                     │   positions / status         │
                     └──────────────┬───────────────┘
                                    │ subscribe()
        ┌────────────┬──────────────┼──────────────┬─────────────┐
        ▼            ▼              ▼              ▼             ▼
   Market Watch  Bid/Ask Board  Order Ticket  Chart header  Account / Positions widgets
                                    ▲
                        only one writer:
                  MarketDataService (controlled polling
                  or stream if Trading Layer supports it)
```

## What we'll build

1. `src/lib/liveMarketDataStore.ts` — vanilla pub/sub store: `getState()`, `subscribe()`, internal setters. Holds:
   - `quotes: Record<symbol, { bid, ask, spread, last, timestamp, source }>`
   - `account` (balance/equity/margin/free/profit/currency/leverage/login/server)
   - `positions[]`
   - `status: "live_stream" | "live_polling" | "stale" | "rate_limited" | "disconnected"`
   - `rateLimit: { active, resumesAt }`
   - `diagnostics: { activeLoops, lastTickAt, polledSymbols[], requestsPerMinute }`

2. `src/services/MarketDataService.ts` — the only writer. Runs three controlled loops:
   - Selected symbol: 1.5 s
   - Watchlist symbols (batched): 7 s
   - Account: 7 s · Positions: 10 s (boosted to 3 s for 30 s after `trade-executed` event)
   - 429 handler: pause all loops 60 s, set `status="rate_limited"`, emit countdown, keep cached prices.
   - Reads from existing `get-live-account` and `get-quotes` (whichever exists; if streaming endpoint exists later, swap in here only).

3. `src/hooks/useLiveMarketData.ts` + selectors (`useQuote(symbol)`, `useAccount()`, `usePositions()`, `useMarketStatus()`).

4. Refactor `LiveAccountContext` to be a thin wrapper that reads from the store (keep the existing API surface so we don't break callers). Delete its own `setInterval`.

5. Disable independent polling in these files (turn each `setInterval`/`setTimeout` loop into a no-op and replace data source with the store):
   - `BrokerSymbolsContext.tsx`
   - `hooks/useMultiSymbolTicks.ts`
   - `hooks/useSelectedQuote.ts`
   - `hooks/useMTAccount.tsx` (keep only event-driven refresh)
   - `dashboard/Watchlist.tsx` · `MarketMovers.tsx` · `ForexTickerBar.tsx`
   - `dashboard/LightweightCandlestickChart.tsx` (chart header price only — keep candle fetch as-is)
   - `dashboard/LiveTradingViewChart.tsx` · `QuickTradePanel.tsx` · `OrderBook.tsx`
   - `BlackArrowTradePanel.tsx` bid/ask reads switch to `useQuote()`
   - Leave non-Trading-Layer pollers alone (news, webinars, smart alerts, execution log).

6. `MarketStatusBadge` component rendering: LIVE STREAM / LIVE POLLING / STALE / RATE LIMITED / DISCONNECTED, with a countdown when rate-limited. Place in dashboard header.

7. Order ticket behavior: always render cached bid/ask. On submit, `submit-best-execution-order` continues to fetch its own server-side fresh tick — no change. Document with a comment that frontend cache must never be the execution source.

8. Dev Mode diagnostics panel `MarketDataDiagnosticsPanel.tsx` added under the existing dev panels in `BlackArrowTradePanel`:
   - active polling loops
   - last tick timestamp (overall + per-symbol)
   - symbols currently polled
   - requests-per-minute estimate (rolling 60 s)
   - rate-limit status + resumesAt

## Out of scope

- No backend changes (no new edge functions, no server-side rate limiting — per project rule).
- True WebSocket streaming: stub the interface in `MarketDataService` so we can plug it in later if Trading Layer adds it. Default runtime path = controlled polling.
- We are not removing unrelated 60s pollers (news, webinars, etc.).

## Validation

- Open `/dashboard`, confirm only the service's loops appear in the Dev diagnostics panel and per-widget intervals are gone.
- Force a 429 by temporarily lowering intervals → badge flips to RATE LIMITED, prices stay visible, countdown ticks, resumes after 60 s.
- Place an order → positions loop boosts for 30 s, then relaxes.

## Technical notes

- Store is framework-agnostic (no React) so the service can run outside component lifecycles. React layer uses `useSyncExternalStore`.
- Service is a singleton started once from `LiveAccountProvider` mount (already top-level under the app).
- Existing custom events (`mt:refresh-positions`, `trade-executed`) are kept and routed into the service's manual-refresh path so existing call sites keep working.
