# Project Memory

## Core
Crypto trading & community hub. Cyan #00f0ff primary, purple #a855f7 secondary, yellow #FFCD05 only on CTAs and LIVE badges.
Background #020202 deep void with cyan/purple blockchain grid + network nodes (CyberpunkBackground.tsx).
Default crypto pairs: BTC, ETH, SOL, SUI, TON, PEPE, WIF, HYPE — all USDT. Centralized in src/lib/crypto-pairs.ts.
Price feed: CoinGecko /simple/price (free, no key). MT4/5 backend tables kept; UI labels say "Wallet / Exchange".
Space Grotesk headings, Inter body. Supabase Cloud backend. SSO integration with Infinox client portal.

## Memories
- [Branding](mem://design/branding) — Crypto cyberpunk, cyan/purple/yellow, Elite Live Trading Room
- [Auth flow](mem://features/auth) — Email+password registration with display_name, SSO edge function for Infinox portal
- [Chat system](mem://features/chat) — Real-time Supabase channels + messages, persistent history, 9 seeded channels
- [MT connection](mem://features/mt-connection) — Two methods to sync MT4/MT5 — MetaApi (cloud) and EA Webhook (free, real-time). Relabeled in UI as "Wallet / Exchange API".
