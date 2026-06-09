// ─────────────────────────────────────────────────────────────────────────────
// sso-login — DISABLED.
//
// The previous implementation accepted a single shared static `SSO_SECRET`
// and minted a session for any email address sent by the caller. That is a
// full authentication-bypass vector (anyone who learns the secret can take
// over any account). It has been removed.
//
// Re-enable only after replacing with proper INFINOX JWT verification:
//   - fetch and cache INFINOX JWKS
//   - verify token signature
//   - check `iss`, `aud`, `exp`, `nbf`
//   - reject reused `jti` within validity window (nonce table)
//   - bind the email/userId to claims in the token, never to caller input
// ─────────────────────────────────────────────────────────────────────────────

import { logSecurityEvent, ipFrom } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Log every attempt so we can see if anyone is still calling this surface.
  await logSecurityEvent({
    event_type: "sso_login_disabled_attempt",
    severity: "warn",
    source: "sso-login",
    ip: ipFrom(req),
    user_agent: req.headers.get("user-agent"),
    details: { method: req.method, path: new URL(req.url).pathname },
  });

  return new Response(
    JSON.stringify({
      error: "SSO login is temporarily disabled pending security review.",
      code: "SSO_DISABLED",
    }),
    {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
