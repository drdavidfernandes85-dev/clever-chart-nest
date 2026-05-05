import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { FreeWebinarTrigger } from "@/components/lead/FreeWebinarModal";
import OnlineNowPill from "@/components/social/OnlineNowPill";
import { track } from "@/lib/analytics";
import SEO from "@/components/SEO";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user, ready, isRefreshing } = useAuth();
  const isRedirectingRef = useRef(false);

  const requestedPath = (location.state as { from?: string } | null)?.from;
  const fromPath = requestedPath && requestedPath !== "/login" ? requestedPath : "/dashboard";

  // Only redirect once auth is ready AND a user is confirmed.
  // This prevents bouncing while session is still being restored.
  useEffect(() => {
    if (ready && isRefreshing) {
      console.log("Redirect prevented during refresh", { path: "/login" });
      return;
    }
    if (ready && !isRefreshing && user) {
      if (isRedirectingRef.current) return;
      isRedirectingRef.current = true;
      navigate(fromPath, { replace: true });
    }
  }, [ready, isRefreshing, user, fromPath, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    track("login", { method: "password" });
    toast.success("Welcome back!");
    // Navigation handled by the useEffect above once ready+user are true.
    // Keep loading=true so the button stays disabled during the handoff.
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <SEO
        title="Login | IX Sala de Trading"
        description="Sign in to access live forex analysis, signals and the IX Sala de Trading community."
        canonical="https://elitelivetradingroom.com/login"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-15" />
        <div className="absolute left-1/3 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-primary/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 lg:flex-none lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <TrendingUp className="h-10 w-10 text-primary" />
              <span className="font-heading text-2xl font-bold text-foreground uppercase">
                <span className="text-primary">IX</span>LTR
              </span>
            </Link>
            <div className="mx-auto mt-4 h-0.5 w-8 bg-primary" />
            <h1 className="mt-4 font-heading text-2xl font-semibold text-primary uppercase">{t("login.title")}</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.email")}
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.password")}
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/80 rounded-full"
            >
              {loading ? t("login.submitting") : t("login.submit")}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <Link to="/" className="text-primary hover:underline">{t("login.backHome")}</Link>
            <Link to="/register" className="text-primary hover:underline">{t("login.signup")}</Link>
            <Link to="/forgot-password" className="text-primary hover:underline">{t("login.forgot")}</Link>
          </div>

          {/* Lead magnet — free webinar */}
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 text-center backdrop-blur-md">
            <p className="text-xs text-muted-foreground">
              Not a member yet? Get a taste of the room first —
            </p>
            <FreeWebinarTrigger
              source="login_page"
              className="h-11 w-full gap-2 rounded-full bg-[#FFCD05] px-6 text-sm font-bold text-black hover:bg-[#FFE066] shadow-[0_0_25px_hsl(45_100%_50%/0.4)]"
            />
            <div className="flex justify-center pt-1">
              <OnlineNowPill />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden items-center justify-center lg:flex lg:flex-1">
        <div className="relative w-[85%] max-w-2xl">
          <div className="overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl">
            <div className="flex h-8 items-center gap-1.5 border-b border-border bg-secondary px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold text-foreground"><span className="text-primary">IX</span> LTR</span>
                </div>
                <div className="flex gap-3 text-[8px] text-muted-foreground">
                  <span>EUR/USD <span className="text-emerald-400">+0.12%</span></span>
                  <span>GBP/USD <span className="text-primary">-0.08%</span></span>
                </div>
              </div>
              {["EUR/USD", "GBP/USD", "AUD/USD", "NZD/USD", "USD/CAD"].map((pair, i) => (
                <div key={pair} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-1.5 text-[9px]">
                  <span className="font-medium text-foreground">{pair}</span>
                  <span className={i % 2 === 0 ? "text-emerald-400" : "text-primary"}>{i % 2 === 0 ? "▲" : "▼"}</span>
                </div>
              ))}
              <div className="flex h-24 items-center justify-center rounded-lg bg-secondary">
                <svg viewBox="0 0 200 60" className="h-16 w-40 text-primary">
                  <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="0,45 20,40 40,42 60,30 80,35 100,20 120,25 140,15 160,18 180,10 200,12" />
                </svg>
              </div>
            </div>
          </div>
          <div className="mx-auto h-4 w-[110%] -translate-x-[5%] rounded-b-xl bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/10" />
        </div>
      </div>
    </div>
  );
};

export default Login;
