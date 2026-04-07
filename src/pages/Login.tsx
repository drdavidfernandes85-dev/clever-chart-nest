import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    } else {
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen bg-background overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-[600px] w-[600px] rounded-full bg-primary/[0.03] blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-ring/[0.03] blur-[100px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,400 Q400,200 800,350 T1600,300" fill="none" stroke="hsl(0,70%,50%)" strokeWidth="1.5" />
          <path d="M0,500 Q300,350 700,450 T1400,400" fill="none" stroke="hsl(190,80%,45%)" strokeWidth="1.5" />
          <path d="M0,600 Q500,400 900,550 T1600,500" fill="none" stroke="hsl(0,70%,50%)" strokeWidth="1" />
        </svg>
      </div>

      {/* Left side — Login form */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 lg:flex-none lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <TrendingUp className="h-10 w-10 text-primary" />
              <span className="font-heading text-2xl font-bold text-foreground">
                Elite<span className="text-primary">LTR</span>
              </span>
            </Link>
            <div className="mx-auto mt-4 h-0.5 w-8 bg-primary" />
            <h1 className="mt-4 font-heading text-2xl font-semibold text-primary">Sign In</h1>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-12 border-0 bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-12 border-0 bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20"
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <Link to="/" className="text-primary hover:underline">Back to Home</Link>
            <Link to="/register" className="text-primary hover:underline">Sign Up</Link>
            <span className="cursor-pointer text-primary hover:underline">Forgot Password?</span>
          </div>
        </div>
      </div>

      {/* Right side — Dashboard preview (hidden on mobile) */}
      <div className="relative z-10 hidden items-center justify-center lg:flex lg:flex-1">
        <div className="relative w-[85%] max-w-2xl">
          {/* Laptop frame */}
          <div className="overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl shadow-background/60">
            {/* Toolbar */}
            <div className="flex h-8 items-center gap-1.5 border-b border-border bg-secondary px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            </div>
            {/* Dashboard screenshot mockup */}
            <div className="p-3 space-y-2">
              {/* Header bar */}
              <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold text-foreground">Elite <span className="text-primary">Live Trading Room</span></span>
                </div>
                <div className="flex gap-3 text-[8px] text-muted-foreground">
                  <span>EUR/USD <span className="text-emerald-400">+0.12%</span></span>
                  <span>GBP/USD <span className="text-red-400">-0.08%</span></span>
                  <span>USD/JPY <span className="text-emerald-400">+0.25%</span></span>
                </div>
              </div>
              {/* Ticker table mockup */}
              <div className="space-y-1">
                {["EUR/USD", "GBP/USD", "AUD/USD", "NZD/USD", "USD/CAD"].map((pair, i) => (
                  <div key={pair} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-1.5 text-[9px]">
                    <span className="font-medium text-foreground">{pair}</span>
                    <div className="flex items-center gap-3">
                      <span className={i % 2 === 0 ? "text-emerald-400" : "text-red-400"}>{i % 2 === 0 ? "▲" : "▼"}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3].map((j) => (
                          <span key={j} className={`h-2 w-2 rounded-full ${j <= 2 ? "bg-emerald-500" : "bg-primary"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Chart placeholder */}
              <div className="flex h-24 items-center justify-center rounded-lg bg-secondary text-[9px] text-muted-foreground">
                <svg viewBox="0 0 200 60" className="h-16 w-40 text-primary">
                  <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="0,45 20,40 40,42 60,30 80,35 100,20 120,25 140,15 160,18 180,10 200,12" />
                </svg>
              </div>
            </div>
          </div>
          {/* Laptop base */}
          <div className="mx-auto h-4 w-[110%] -translate-x-[5%] rounded-b-xl bg-gradient-to-b from-muted-foreground/30 to-muted-foreground/20" />
        </div>
      </div>
    </div>
  );
};

export default Login;
