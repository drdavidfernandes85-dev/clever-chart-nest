/**
 * Lightweight analytics wrapper for Google Analytics (GA4), Meta Pixel,
 * and the internal Supabase analytics_events table.
 *
 * Calls are wrapped in try/catch so a missing vendor never breaks the UI.
 */
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

const persistEvent = (
  event: string,
  params: Record<string, unknown>,
  path?: string,
) => {
  try {
    const section = (params.section as string | undefined) ?? null;
    void supabase.from("analytics_events").insert({
      event,
      section,
      path: path ?? (typeof window !== "undefined" ? window.location.pathname : null),
      params: params as never,
    });
  } catch {
    /* noop */
  }
};

export type TrackEvent =
  | "login"
  | "register"
  | "connect_mt_click"
  | "open_infinox_account_click"
  | "open_infinox_account_impression"
  | "deposit_click"
  | "webinar_signup"
  | "lead_capture"
  | "exit_intent_shown"
  | "free_webinar_open"
  | "cta_click"
  | "webinar_form_impression"
  | "webinar_form_field_focus"
  | "webinar_form_submit_attempt"
  | "webinar_form_submit_success"
  | "webinar_form_submit_error"
  | "webinar_form_duplicate_blocked"
  | "webinar_register_cta_click"
  | "webinar_confirmation_email_sent"
  | "webinar_confirmation_email_error"
  | "lead_persist_error"
  | "contact_submit"
  | "contact_submit_success"
  | "contact_submit_error"
  | "newsletter_submit"
  | "newsletter_submit_success"
  | "newsletter_submit_error"
  | "internal_link_click"
  | "language_change";

export const track = (event: TrackEvent, params: Record<string, unknown> = {}) => {
  if (typeof window === "undefined") return;
  // Persist to internal store first (best-effort)
  persistEvent(event, params);
  try {
    window.gtag?.("event", event, params);
  } catch {
    /* noop */
  }
  try {
    const standardMap: Partial<Record<TrackEvent, string>> = {
      register: "CompleteRegistration",
      lead_capture: "Lead",
      webinar_signup: "Lead",
    };
    const standard = standardMap[event];
    if (standard) {
      window.fbq?.("track", standard, params);
    } else {
      window.fbq?.("trackCustom", event, params);
    }
  } catch {
    /* noop */
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, params);
  }
};

export const trackPageView = (path: string) => {
  if (typeof window === "undefined") return;
  persistEvent("page_view", { section: "navigation", path }, path);
  try {
    window.gtag?.("event", "page_view", { page_path: path });
  } catch {
    /* noop */
  }
  try {
    window.fbq?.("track", "PageView");
  } catch {
    /* noop */
  }
};
