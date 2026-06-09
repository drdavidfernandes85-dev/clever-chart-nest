// Shared helpers for security_events logging, admin alerting,
// and webhook replay protection (timestamp skew + nonce dedup).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_EMAIL_TO = Deno.env.get("SECURITY_ALERT_EMAIL") ?? "";

const adminClient = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export type Severity = "info" | "warn" | "error" | "critical";

export interface SecurityEvent {
  event_type: string;
  severity?: Severity;
  source: string;
  ip?: string | null;
  user_agent?: string | null;
  subject_email?: string | null;
  subject_user_id?: string | null;
  details?: Record<string, unknown>;
}

export function ipFrom(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

/**
 * Log a security event (best-effort) and, when severity >= 'error' AND
 * RESEND_API_KEY + SECURITY_ALERT_EMAIL are configured, email an admin.
 * Never throws — failures are swallowed so security logging never breaks
 * the calling request.
 */
export async function logSecurityEvent(evt: SecurityEvent): Promise<void> {
  const severity: Severity = evt.severity ?? "warn";
  try {
    const sb = adminClient();
    await sb.from("security_events").insert({
      event_type: evt.event_type,
      severity,
      source: evt.source,
      ip: evt.ip ?? null,
      user_agent: evt.user_agent ?? null,
      subject_email: evt.subject_email ?? null,
      subject_user_id: evt.subject_user_id ?? null,
      details: evt.details ?? {},
    });
  } catch (e) {
    console.warn("security_events insert failed:", (e as Error).message);
  }

  if ((severity === "error" || severity === "critical") && RESEND_API_KEY && ALERT_EMAIL_TO) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "IX LTR Security <onboarding@resend.dev>",
          to: [ALERT_EMAIL_TO],
          subject: `[${severity.toUpperCase()}] ${evt.event_type} — ${evt.source}`,
          html: `
            <h2>Security event: ${evt.event_type}</h2>
            <p><strong>Source:</strong> ${evt.source}</p>
            <p><strong>Severity:</strong> ${severity}</p>
            <p><strong>IP:</strong> ${evt.ip ?? "—"}</p>
            <p><strong>Subject email:</strong> ${evt.subject_email ?? "—"}</p>
            <p><strong>Subject user:</strong> ${evt.subject_user_id ?? "—"}</p>
            <pre style="background:#f6f6f6;padding:12px;border-radius:6px;font-size:12px;">${
              escapeHtml(JSON.stringify(evt.details ?? {}, null, 2))
            }</pre>
          `,
        }),
      });
    } catch (e) {
      console.warn("security alert email failed:", (e as Error).message);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Verify a webhook timestamp is within `skewSeconds` of now.
 * Pass the value of the relevant header (e.g. `x-tl-timestamp`).
 * Accepts ISO-8601 strings or unix seconds/milliseconds.
 */
export function verifyTimestamp(
  raw: string | null,
  skewSeconds = 300,
): { ok: true; ts: number } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: "missing_timestamp" };
  let ms: number;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    ms = n > 1e12 ? n : n * 1000; // tolerate seconds or millis
  } else {
    ms = Date.parse(raw);
    if (Number.isNaN(ms)) return { ok: false, reason: "invalid_timestamp" };
  }
  const diff = Math.abs(Date.now() - ms) / 1000;
  if (diff > skewSeconds) return { ok: false, reason: "stale_timestamp" };
  return { ok: true, ts: ms };
}

/**
 * Reserve a nonce for replay protection. Returns true if accepted (first time
 * seen), false if it's a replay. `expiresInSeconds` should cover the timestamp
 * skew window with margin.
 */
export async function reserveNonce(
  source: string,
  nonce: string,
  expiresInSeconds = 600,
): Promise<boolean> {
  try {
    const sb = adminClient();
    const { error } = await sb.from("webhook_nonces").insert({
      source,
      nonce,
      expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    });
    if (!error) return true;
    // 23505 unique violation → replay
    // deno-lint-ignore no-explicit-any
    if ((error as any).code === "23505") return false;
    // On other errors, fail-open (don't break webhook) but log
    console.warn("reserveNonce error:", error.message);
    return true;
  } catch (e) {
    console.warn("reserveNonce exception:", (e as Error).message);
    return true;
  }
}
