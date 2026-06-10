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

const REDIRECT_URL = `${window.location.origin}/auth/callback`;

/**
 * Combined reset-password page:
 *  - Default: shows "request reset" form (email + captcha).
 *  - When Supabase auth state is PASSWORD_RECOVERY (user arrived from the
 *    email link via /auth/callback), shows the "set new password" form.
 *  Same generic, non-enumerating message on the request step.
 */
const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const navigate = useNavigate();

  const captchaRequired = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const captchaReady = !captchaRequired || Boolean(captchaToken);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && window.location.hash.includes("type=recovery"))) {
        setRecoveryMode(true);
      }
    });
    // If the user lands here directly with an existing recovery session
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
      toast.error("Ingresa tu correo");
      return;
    }
    if (!captchaReady) {
      toast.error("Completa el CAPTCHA para continuar");
      return;
    }
    setRequestLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: REDIRECT_URL,
      captchaToken: captchaToken ?? undefined,
    });
    setRequestLoading(false);
    // Always show generic confirmation; never reveal whether email exists.
    if (error && !/rate/i.test(error.message)) {
      // Only surface true infrastructure errors
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
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setUpdateLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setUpdateLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contraseña actualizada. Inicia sesión nuevamente.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <SEO
        title="Restablecer contraseña | IX LTR"
        description="Restablece la contraseña de tu cuenta IX LTR."
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
            {recoveryMode ? "Nueva contraseña" : "Restablecer contraseña"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {recoveryMode
              ? "Define una nueva contraseña para tu cuenta."
              : "Te enviaremos un enlace para restablecerla."}
          </p>
        </div>

        {recoveryMode ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 8)"
              className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground"
            />
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirma la nueva contraseña"
              className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              disabled={updateLoading}
              className="h-12 w-full gap-2 rounded-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066]"
            >
              {updateLoading ? "Guardando..." : "Actualizar contraseña"}
              {!updateLoading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>
        ) : sent ? (
          <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-foreground">
              Si la cuenta existe, te enviamos un correo con instrucciones.
            </p>
            <Button
              variant="outline"
              onClick={() => setSent(false)}
              className="h-10 w-full rounded-full"
            >
              Usar otro correo
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
              placeholder="Correo electrónico"
              className="h-12 rounded-full border-border bg-secondary px-5 text-foreground placeholder:text-muted-foreground"
            />
            <TurnstileWidget
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
            />
            <Button
              type="submit"
              disabled={requestLoading || !captchaReady}
              className="h-12 w-full gap-2 rounded-full bg-[#FFCD05] font-bold text-black hover:bg-[#FFE066]"
            >
              {requestLoading ? "Enviando..." : "Enviar enlace"}
              {!requestLoading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
