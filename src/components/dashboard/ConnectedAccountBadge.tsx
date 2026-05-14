import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Floating "Connected" badge — visible globally once the user has a connected
 * MT5 account. Clicking it opens /connect-mt (which renders the
 * already-connected state).
 */
const ConnectedAccountBadge = () => {
  const [info, setInfo] = useState<{ login: string; server: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures?.user?.id;
      if (!uid) {
        if (!cancelled) setInfo(null);
        return;
      }
      const { data: row } = await supabase
        .from("user_mt_accounts")
        .select("login, server_name")
        .eq("user_id", uid)
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setInfo(row ? { login: String(row.login ?? ""), server: String(row.server_name ?? "") } : null);
    };
    load();

    // Refresh on auth changes and when the user navigates back to the tab
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!info) return null;

  return (
    <Link
      to="/connect-mt"
      className="hidden md:inline-flex fixed top-3 right-3 z-40 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest backdrop-blur-md transition-colors hover:brightness-110"
      style={{
        borderColor: "rgba(74, 222, 128, 0.35)",
        backgroundColor: "rgba(15, 15, 15, 0.75)",
        color: "#4ade80",
      }}
      title={`Connected: ${info.login} • ${info.server}`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>Connected</span>
      <span className="text-neutral-300/80 normal-case tracking-normal">#{info.login}</span>
    </Link>
  );
};

export default ConnectedAccountBadge;
