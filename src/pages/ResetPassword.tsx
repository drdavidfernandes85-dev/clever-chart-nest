import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";

/**
 * Reset password page.
 * Reached from the password-reset email link. Supabase establishes a
 * temporary recovery session via the link, so we just call updateUser.
 */
const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // The auth listener fires PASSWORD_RECOVERY when the user lands here
    // from the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
      }
    });
    // Also check if a session already exists (e.g. landed and re-rendered)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasRecoverySession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <SEO
        title="Reset Password | IX LTR"
        description="Set a new password for your IX LTR account."
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-15" />
        <div className="absolute left-1/3 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <TrendingUp className="h-10 w-10 text-primary" />
            <span className="font-heading text-2xl font-bold text-foreground uppercase">
              <span className="text-primary">IX</span>LTR
            </span>
          </Link>
          <div className="mx-auto mt-4 h-0.5 w-8 bg-primary" />
          <h1 className="mt-4 font-heading text-2xl font-semibold text-primary uppercase">
            Reset password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>

        {!hasRecoverySession ? (
          <div className="rounded-2xl border border-border bg-secondary/50 p-5 text-center text-sm text-muted-foreground">
            Validating reset link…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/80 rounded-full"
            >
              {loading ? "Updating…" : "Update password"}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
