import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, Mail, MailCheck } from "lucide-react";
import LtrLogo from "@/components/branding/LtrLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { track } from "@/lib/analytics";
import { useLanguage } from "@/i18n/LanguageContext";

const REDIRECT_URL = `${window.location.origin}/auth/callback`;
const RESEND_COOLDOWN_SECS = 60;

const Login = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready, isRefreshing } = useAuth();
  const isRedirectingRef = useRef(false);

  const requestedPath = (location.state as { from?: string } | null)?.from;
  const fromPath = requestedPath && requestedPath !== "/login" ? requestedPath : "/dashboard";

  const captchaRequired = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const captchaReady = !captchaRequired || Boolean(captchaToken);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaResetKey((k) => k + 1);
  };

  useEffect(() => {
    if (ready && !isRefreshing && user) {
      if (isRedirectingRef.current) return;
      isRedirectingRef.current = true;
      navigate(fromPath, { replace: true });
    }
  }, [ready, isRefreshing, user, fromPath, navigate]);

  // Resend cooldown tick.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(t("auth.error.missing"));
      return;
    }
    if (!captchaReady) {
      toast.error(t("auth.error.captcha"));
      return;
    }
    setLoading(true);
    setNeedsConfirmation(false);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken: captchaToken ?? undefined },
    });
    setLoading(false);
    resetCaptcha();
    if (error) {
      if (/confirm|verified|verification/i.test(error.message)) {
        setNeedsConfirmation(true);
        return;
      }
      toast.error(t("auth.error.loginGeneric"));
      return;
    }
    track("login", { method: "password" });
    toast.success(t("auth.welcome"));
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      toast.error(t("auth.error.missingEmailFirst"));
      return;
    }
    if (!captchaReady) {
      toast.error(t("auth.error.captcha"));
      return;
    }
    setMagicLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: REDIRECT_URL,
        shouldCreateUser: false,
        captchaToken: captchaToken ?? undefined,
      },
    });
    setMagicLoading(false);
    resetCaptcha();
    if (error && !/already|exists|registered|not\s*found/i.test(error.message)) {
      toast.error(error.message);
      return;
    }
    setMagicSent(true);
  };

  const handleResendConfirmation = async () => {
    if (!email.trim() || resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: REDIRECT_URL,
        captchaToken: captchaToken ?? undefined,
      },
    });
    setResendLoading(false);
    resetCaptcha();
    // Always start cooldown so the UI matches the backend's 60s rate-limit,
    // even if the request errored (rate-limit / already confirmed / etc.).
    setResendCooldown(RESEND_COOLDOWN_SECS);
    if (error && !/rate|already/i.test(error.message)) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.login.resendDone"));
  };

  const resendLabel = resendLoading
    ? t("auth.login.resendLoading")
    : resendCooldown > 0
    ? t("auth.login.resendCooldown").replace("{s}", String(resendCooldown))
    : t("auth.login.resend");

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <SEO
        title={`${t("auth.title.login")} | IX LTR`}
        description={t("auth.subtitle.signup")}
        canonical="https://elitelivetradingroom.com/login"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-15" />
        <div className="absolute left-1/3 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <LtrLogo variant="platform" className="h-14 w-auto" />
          </Link>
          <div className="mx-auto mt-4 h-0.5 w-8 bg-[#FFCD05]" />
          <h1 className="mt-4 font-heading text-2xl font-semibold text-[#FFCD05] uppercase tracking-[0.08em]">
            {t("auth.title.login")}
          </h1>
        </div>

        {magicSent ? (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
            <MailCheck className="mx-auto h-8 w-8 text-primary" />
            <p className="text-sm text-foreground">{t("auth.login.magicSent")}</p>
            <Button
              variant="outline"
              onClick={() => setMagicSent(false)}
              className="h-10 w-full rounded-full"
            >
              {t("auth.login.back")}
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.field.email")}
                className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.field.password")}
                className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/50"
              />

              <TurnstileWidget
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken(null)}
                resetKey={captchaResetKey}
              />

              <Button
                type="submit"
                disabled={loading || !captchaReady}
                className="h-12 w-full gap-2 rounded-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066] shadow-[0_0_25px_hsl(45_100%_50%/0.35)]"
              >
                {loading ? t("auth.cta.loginLoading") : t("auth.cta.login")}
                {!loading && <ChevronRight className="h-4 w-4" />}
              </Button>
            </form>

            {needsConfirmation && (
              <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-center">
                <p className="text-sm text-amber-200">{t("auth.login.unconfirmed")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resendLoading || resendCooldown > 0}
                  onClick={handleResendConfirmation}
                  className="h-9 w-full rounded-full"
                >
                  {resendLabel}
                </Button>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("auth.divider.or")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={magicLoading || !captchaReady}
              onClick={handleMagicLink}
              className="h-12 w-full gap-2 rounded-full border-primary/40 text-foreground hover:bg-primary/10"
            >
              <Mail className="h-4 w-4" />
              {magicLoading ? t("auth.cta.magicLoading") : t("auth.cta.magic")}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <Link to="/reset-password" className="text-primary hover:underline">
                {t("auth.link.forgot")}
              </Link>
              <p className="text-muted-foreground">
                {t("auth.link.noAccount")}{" "}
                <Link to="/signup" className="text-primary hover:underline">
                  {t("auth.link.signupInline")}
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
