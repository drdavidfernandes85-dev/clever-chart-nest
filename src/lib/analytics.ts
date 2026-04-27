/**
 * Lightweight analytics wrapper for Google Analytics (GA4) and Meta Pixel.
 *
 * Both vendors are loaded as no-op stubs in `index.html`. Replace the
 * placeholder IDs in index.html with real ones and events flow through
 * automatically — no code changes needed.
 *
 * Calls are wrapped in try/catch so a missing vendor never breaks the UI.
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export type TrackEvent =
  | "login"
  | "register"
  | "connect_mt_click"
  | "deposit_click"
  | "webinar_signup"
  | "lead_capture"
  | "exit_intent_shown"
  | "free_webinar_open"
  | "cta_click";

export const track = (event: TrackEvent, params: Record<string, unknown> = {}) => {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
  } catch {
    /* noop */
  }
  try {
    // Meta Pixel uses standard events for a few; the rest are custom.
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
  // Always log in dev for visibility
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, params);
  }
};

export const trackPageView = (path: string) => {
  if (typeof window === "undefined") return;
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
