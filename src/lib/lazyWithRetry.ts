import { lazy, type ComponentType } from "react";

/**
 * Wrap React.lazy with a one-shot retry. When a previously-loaded chunk
 * is no longer available (e.g. after a deploy or Vite HMR invalidation),
 * the dynamic import rejects with "Failed to fetch dynamically imported
 * module". We retry once, then force a hard reload so the user lands on
 * the latest bundle instead of seeing a blank screen.
 */
export const lazyWithRetry = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) =>
  lazy(async () => {
    try {
      return await factory();
    } catch {
      try {
        return await factory();
      } catch (err) {
        if (typeof window !== "undefined") {
          const flag = "ixltr.chunkReload";
          if (!sessionStorage.getItem(flag)) {
            sessionStorage.setItem(flag, String(Date.now()));
            window.location.reload();
          }
        }
        throw err;
      }
    }
  });
