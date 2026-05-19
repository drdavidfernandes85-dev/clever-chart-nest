import { useEffect, useState } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const KEY = "lovable.devMode";
const EVT = "lovable:devmode-change";

const read = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

/**
 * Dev Mode flag — gates debug panels in production.
 * Only admins can flip the flag (and only admins see the toggle UI).
 * Non-admins always get `devMode === false` even if they tamper with
 * localStorage, because the hook re-checks `isAdmin`.
 */
export function useDevMode() {
  const { isAdmin, loading } = useIsAdmin();
  const [enabled, setEnabled] = useState(read);

  useEffect(() => {
    const onChange = () => setEnabled(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setDevMode = (v: boolean) => {
    try {
      if (v) localStorage.setItem(KEY, "1");
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    setEnabled(v);
    try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ }
  };

  const devMode = isAdmin && enabled;
  return { devMode, isAdmin, adminLoading: loading, setDevMode, rawEnabled: enabled };
}
