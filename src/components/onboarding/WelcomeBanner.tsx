import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plug, Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMTAccount } from "@/hooks/useMTAccount";

const DISMISS_KEY = "ixltr.welcomeBanner.dismissed";

// Show only on these post-login routes
const ELIGIBLE_ROUTES = ["/dashboard", "/profile", "/webinars", "/videos"];

const WelcomeBanner = () => {
  const { user, profile, ready } = useAuth();
  const { account, loading } = useMTAccount();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && !!localStorage.getItem(DISMISS_KEY));
  }, []);

  if (!ready || !user) return null;
  if (loading) return null;
  if (account) return null; // already connected
  if (dismissed) return null;
  if (!ELIGIBLE_ROUTES.some((p) => location.pathname.startsWith(p))) return null;
  // Hide on the connect-mt page itself
  if (location.pathname.startsWith("/connect-mt")) return null;

  const name = profile?.display_name || user.email?.split("@")[0] || "trader";

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 backdrop-blur-md shadow-[0_0_30px_hsl(45_100%_50%/0.15)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="font-heading text-base font-bold text-foreground sm:text-lg">
              Welcome to <span className="text-primary">IX LTR</span>, {name}!
            </h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Next step: connect your Infinox MT5 account to view your portfolio and join the community.
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            asChild
            size="sm"
            className="h-9 flex-1 gap-1.5 rounded-full bg-[#FFCD05] px-4 font-semibold text-black hover:bg-[#FFE066] cta-pulse shadow-[0_0_20px_hsl(45_100%_50%/0.4)] sm:flex-none"
          >
            <Link to="/connect-mt">
              <Plug className="h-3.5 w-3.5" />
              Connect MT5
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
