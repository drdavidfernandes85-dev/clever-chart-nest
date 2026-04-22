import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import SEO from "@/components/SEO";

const Register = () => {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! You can now log in.");
      navigate("/login");
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <SEO
        title="Create Account | Elite Live Trading Room"
        description="Create your free account and join the Elite Live Trading Room — live forex analysis, signals and a pro community."
        canonical="https://elitelivetradingroom.com/register"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-15" />
        <div className="absolute left-1/3 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 lg:flex-none lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <TrendingUp className="h-10 w-10 text-primary" />
              <span className="font-heading text-2xl font-bold text-foreground uppercase">
                Elite<span className="text-primary">LTR</span>
              </span>
            </Link>
            <div className="mx-auto mt-4 h-0.5 w-8 bg-primary" />
            <h1 className="mt-4 font-heading text-2xl font-semibold text-primary uppercase">{t("register.title")}</h1>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("register.name")}
              maxLength={30}
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("register.email")}
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("register.password")}
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/80 rounded-full"
            >
              {loading ? t("register.submitting") : t("register.submit")}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <Link to="/" className="text-primary hover:underline">{t("register.backHome")}</Link>
            <Link to="/login" className="text-primary hover:underline">{t("register.login")}</Link>
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
                  <span className="text-[10px] font-bold text-foreground">Elite <span className="text-primary">Live Trading Room</span></span>
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

export default Register;
