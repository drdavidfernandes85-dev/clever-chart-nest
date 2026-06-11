# Project Memory

## Core
Elite Live Trading Room for Infinox LATAM community. Yellow branding hsl(45,100%,50%). Dark theme bg hsl(220,20%,10%).
Space Grotesk headings, Inter body. Supabase Cloud backend.
Supabase Auth is the ONLY identity provider — no SSO, no token-in-URL login, no alternative login paths.

## Memories
- [Branding](mem://design/branding) — Yellow/gold accent color, Infinox-inspired, Elite Live Trading Room name
- [Auth flow](mem://features/auth) — Email+password registration with display_name (Supabase Auth only; sso-login function removed 2026-06-11)
- [Chat system](mem://features/chat) — Real-time Supabase channels + messages, persistent history, 9 seeded channels
- [MT connection](mem://features/mt-connection) — Two-tab UI on /connect-mt: MetaApi (cloud) + EA Webhook (free, real-time via mt-webhook edge function)
- [Execution mode](mem://features/execution-mode) — admin_live_test gates backend live orders to admin tester (trader 29008868…, login 87943580); modes persisted in site_settings
