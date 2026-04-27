import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

// Disable eager SDK auto-refresh before React mounts; AuthProvider performs
// single-flight scheduled refreshes with 429 backoff to prevent token storms.
supabase.auth.stopAutoRefresh();

// Remove stale PWA caches globally so production users receive the latest auth code.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

if ("caches" in window) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
}

createRoot(document.getElementById("root")!).render(<App />);
