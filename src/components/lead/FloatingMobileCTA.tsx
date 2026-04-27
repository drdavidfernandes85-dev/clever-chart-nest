import { Link, useLocation } from "react-router-dom";
import { Plug } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMTAccount } from "@/hooks/useMTAccount";

// Hide on these routes (already promoting connect, or wrong context)
const HIDE_ON = ["/connect-mt", "/login", "/register", "/forgot-password", "/reset-password"];

const FloatingMobileCTA = () => {
  const location = useLocation();
  const { user, ready } = useAuth();
  const { account, loading } = useMTAccount();

  if (!ready || !user) return null;
  if (loading) return null;
  if (account) return null;
  if (HIDE_ON.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <Link
      to="/connect-mt"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full bg-[#FFCD05] px-4 py-3 text-sm font-bold text-black cta-pulse shadow-[0_0_30px_hsl(45_100%_50%/0.5),0_8px_24px_rgba(0,0,0,0.45)] hover:bg-[#FFE066] md:hidden"
      aria-label="Connect your MT account"
    >
      <Plug className="h-4 w-4" />
      Connect Account
    </Link>
  );
};

export default FloatingMobileCTA;
