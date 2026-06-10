import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Mail, MailCheck } from "lucide-react";
import LtrLogo from "@/components/branding/LtrLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { useLanguage } from "@/i18n/LanguageContext";

const REDIRECT_URL = `${window.location.origin}/auth/callback`;

const Signup = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const captchaRequired = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const captchaReady = !captchaRequired || Boolean(captchaToken);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaResetKey((k) => k + 1);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(t("auth.error.missing"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("auth.error.passwordShort"));
      return;
    }
    if (!captchaReady) {
      toast.error(t("auth.error.captcha"));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: REDIRECT_URL,
        captchaToken: captchaToken ?? undefined,
      },
    });

    // Hard-prevent any auto-login.
    if (data?.session) await supabase.auth.signOut();

    setLoading(false);
    resetCaptcha();

    if (error) {
      const benign = /already|exists|registered/i.test(error.message);
      if (!benign) {
        toast.error(error.message);
        return;
      }
    }
    setSent(true);
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
        shouldCreateUser: true,
        captchaToken: captchaToken ?? undefined,
      },
    });
    setMagicLoading(false);
    resetCaptcha();
    if (error && !/already|exists|registered/i.test(error.message)) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <SEO title={`${t("auth.title.signup")} | IX LTR`} description={t("auth.subtitle.signup")} />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-15" />
        <div className="absolute left-1/3 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-7">
        <div className="text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <LtrLogo variant="platform" className="h-14 w-auto" />
          </Link>
          <div className="mx-auto mt-4 h-0.5 w-8 bg-[#FFCD05]" />
          <h1 className="mt-4 font-heading text-2xl font-semibold text-[#FFCD05] uppercase tracking-[0.08em]">
            {t("auth.title.signup")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle.signup")}</p>
        </div>

        {sent ? (
          <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-primary" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t("auth.signup.pending.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("auth.signup.pending.body")}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSent(false)}
              className="h-10 w-full rounded-full"
            >
              {t("auth.signup.useAnother")}
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSignup} className="space-y-4">
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.field.passwordNew")}
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
                {loading ? t("auth.cta.signupLoading") : t("auth.cta.signup")}
                {!loading && <ChevronRight className="h-4 w-4" />}
              </Button>
            </form>

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

            <p className="text-center text-xs text-muted-foreground">
              {t("auth.link.haveAccount")}{" "}
              <Link to="/login" className="text-primary hover:underline">
                {t("auth.link.loginInline")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Signup;
