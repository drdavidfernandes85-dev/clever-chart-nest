import { Link } from "react-router-dom";
import { useMTAccount } from "@/hooks/useMTAccount";
import { Plug, PlugZap } from "lucide-react";

/**
 * Compact "Connected to Infinox MT5" indicator for page top-navs.
 * Reads the user's MT account status. Renders a yellow dot when connected,
 * a muted dot otherwise, and links to /connect-mt when not connected.
 */
const MT5StatusBadge = ({ className = "" }: { className?: string }) => {
  const { account, loading } = useMTAccount();
  const status = account?.status ?? null;
  const connected = status === "connected";

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
        Checking MT5…
      </span>
    );
  }

  if (connected) {
    return (
      <span
        title={`MT5 #${account?.login ?? ""} · ${account?.server_name ?? ""}`}
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <PlugZap className="h-3 w-3" />
        Connected · Infinox MT5
      </span>
    );
  }

  return (
    <Link
      to="/connect-mt"
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#FFCD05]/30 bg-[#FFCD05]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FFCD05] hover:bg-[#FFCD05]/20 transition-colors ${className}`}
    >
      <Plug className="h-3 w-3" />
      Connect MT5
    </Link>
  );
};

export default MT5StatusBadge;
