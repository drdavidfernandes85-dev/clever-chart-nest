---
name: Security posture
description: Backend security hardening: SSO disabled, webhook signing required, public endpoints behind JWT, security_events + nonces tables
type: feature
---
- `sso-login` edge function is hard-disabled (returns 503 SSO_DISABLED). Do not re-enable until JWKS-based INFINOX token verification is implemented (signature + iss + aud + exp + nbf + jti replay protection).
- `trading-layer-webhook` requires `TRADING_LAYER_WEBHOOK_SECRET`; HMAC is computed over `${timestamp}.${rawBody}`; rejects requests outside ±5min skew; rejects reused `x-tl-event-id` via `webhook_nonces`.
- `mt-webhook` accepts the per-user token ONLY via headers (`x-webhook-token`, `x-api-key`, or `Authorization: Bearer`). Query-string tokens removed. Optional `x-mt-timestamp` + `x-mt-nonce` headers enable timestamp/replay defenses.
- Public market-data passthroughs (`fetch-economic-calendar`, `fetch-forex-tickers`, `fetch-market-quotes`, `fetch-rss-news`) now require a valid Supabase JWT via `_shared/auth.ts#requireUser`.
- `security_events` table logs auth-related incidents; admins can SELECT. `_shared/security.ts#logSecurityEvent` writes + optionally emails admin when severity >= 'error' and `RESEND_API_KEY` + `SECURITY_ALERT_EMAIL` secrets are set.
- KNOWN OPEN: `metaapi_token_encrypted` / `investor_password_encrypted` are NOT encrypted — they are base64 with an `enc:` prefix marker. Treat as plaintext at rest. Either stop persisting the MetaApi token (re-prompt on connect) or implement real AES-GCM with a key in Edge Function secrets (separate ticket).
- `channels` policy `qual=true` for SELECT to authenticated is intentional pending product decision on tier-gated channels. If gated channels are introduced, add `channel_members` + membership-check policy.
