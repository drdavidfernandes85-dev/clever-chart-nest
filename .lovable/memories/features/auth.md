---
name: Auth flow
description: Spanish-LatAm auth pages with Turnstile captcha, magic-link, no auto-login on signup
type: feature
---
Public auth routes:
- `/signup` — email+password + "Enviar enlace de acceso" magic-link. Never auto-logs in (calls `signOut()` if signUp returns a session). Shows generic "Si la cuenta existe, te enviamos un correo" confirmation regardless of whether the email exists.
- `/login` — email+password + magic-link + "¿Olvidaste tu contraseña?" link. Detects "email not confirmed" error and shows "Confirma tu correo para iniciar sesión" + "Reenviar correo de confirmación" button (uses `supabase.auth.resend({ type: "signup" })`).
- `/reset-password` — dual mode: request form (with captcha, generic confirmation) AND post-link new-password form when Supabase emits `PASSWORD_RECOVERY`.
- `/auth/callback` — listens for `PASSWORD_RECOVERY` → `/reset-password`, otherwise session → `/dashboard`. 6s timeout falls back to `/login`.

All redirect URLs use `${window.location.origin}/auth/callback`.

Cloudflare Turnstile via `@marsidev/react-turnstile` on signup/login/reset request. Site key read from `VITE_TURNSTILE_SITE_KEY`; if unset the widget shows a "no configurado" notice and the form treats captcha as optional. Captcha token is passed as `options.captchaToken` to Supabase Auth calls (signUp, signInWithPassword, signInWithOtp, resetPasswordForEmail, resend).

Legacy English `/register` → redirect to `/signup`. `/forgot-password` → redirect to `/reset-password`. Old `Register.tsx` and `ForgotPassword.tsx` files retained but no longer routed.

No token-minting / SSO endpoint. Supabase Auth is the only identity source. (See `sso-login` edge function — hard-disabled, returns 503.)
