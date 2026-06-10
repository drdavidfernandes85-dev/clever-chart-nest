import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, MailCheck } from "lucide-react";
import LtrLogo from "@/components/branding/LtrLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { useLanguage } from "@/i18n/LanguageContext";

const REDIRECT_URL = `${window.location.origin}/auth/callback`;

const ResetPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [requestLoading, setRequestLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const navigate = useNavigate();

  const captchaRequired = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const captchaReady = !captchaRequired || Boolean(captchaToken);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaResetKey((k) => k + 1);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && window.location.hash.includes("type=recovery"))) {
        setRecoveryMode(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && window.location.hash.includes("type=recovery")) {
        setRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t("auth.error.missingEmail"));
      return;
    }
    if (!captchaReady) {
      toast.error(t("auth.error.captcha"));
      return;
    }
    setRequestLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: REDIRECT_URL,
      captchaToken: captchaToken ?? undefined,
    });
    setRequestLoading(false);
    resetCaptcha();
    if (error && !/rate/i.test(error.message)) {
      if (!/not\s*found|invalid|exists/i.test(error.message)) {
        toast.error(error.message);
        return;
      }
    }
    setSent(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.error.passwordShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.error.passwordMismatch"));
      return;
    }
    setUpdateLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setUpdateLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.reset.success"));
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <SEO
        title={`${t("auth.title.reset")} | IX LTR`}
        description={t("auth.subtitle.reset")}
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
            {recoveryMode ? t("auth.title.resetNew") : t("auth.title.reset")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {recoveryMode ? t("auth.subtitle.resetNew") : t("auth.subtitle.reset")}
          </p>
        </div>

        {recoveryMode ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.field.passwordNewShort")}
              className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground"
            />
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("auth.field.passwordConfirm")}
              className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              disabled={updateLoading}
              className="h-12 w-full gap-2 rounded-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066]"
            >
              {updateLoading ? t("auth.cta.resetUpdateLoading") : t("auth.cta.resetUpdate")}
              {!updateLoading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>
        ) : sent ? (
          <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-foreground">{t("auth.reset.requestSent")}</p>
            <Button
              variant="outline"
              onClick={() => setSent(false)}
              className="h-10 w-full rounded-full"
            >
              {t("auth.signup.useAnother")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleRequest} className="space-y-4">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.field.email")}
              className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground"
            />
            <TurnstileWidget
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              resetKey={captchaResetKey}
            />
            <Button
              type="submit"
              disabled={requestLoading || !captchaReady}
              className="h-12 w-full gap-2 rounded-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066]"
            >
              {requestLoading ? t("auth.cta.resetRequestLoading") : t("auth.cta.resetRequest")}
              {!requestLoading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            {t("auth.link.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
