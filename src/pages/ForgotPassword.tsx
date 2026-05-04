import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Check your inbox for the reset link");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <SEO
        title="Forgot Password | IX LTR"
        description="Reset your IX LTR account password."
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
            Forgot password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center text-sm text-foreground">
            <p>
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </p>
            <p className="mt-2 text-muted-foreground">
              Don&apos;t forget to check your spam folder.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="h-12 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-5 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/80 rounded-full"
            >
              {loading ? "Sending…" : "Send reset link"}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        <div className="flex items-center justify-center gap-2 text-sm">
          <Link to="/login" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
