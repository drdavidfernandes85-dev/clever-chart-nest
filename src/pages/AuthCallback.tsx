import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LtrLogo from "@/components/branding/LtrLogo";
import SEO from "@/components/SEO";

/**
 * Handles email confirmation, magic-link, and password-recovery redirects.
 * Supabase parses the URL hash/query and emits an auth event; we listen and
 * route based on the event type.
 *  - PASSWORD_RECOVERY → /reset-password (set new password form)
 *  - SIGNED_IN / others with session → /dashboard
 *  - no session after a short wait → /login with error
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Confirmando tu sesión...");

  useEffect(() => {
    let settled = false;

    const finish = (path: string, replace = true) => {
      if (settled) return;
      settled = true;
      navigate(path, { replace });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        finish("/reset-password");
        return;
      }
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        finish("/dashboard");
      }
    });

    // Also probe synchronously in case the SDK already restored the session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !settled) {
        // PASSWORD_RECOVERY is delivered via the listener; if hash mentions
        // type=recovery, route there. Otherwise, dashboard.
        if (window.location.hash.includes("type=recovery")) {
          finish("/reset-password");
        } else {
          finish("/dashboard");
        }
      }
    });

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setStatus("error");
      setMessage("No pudimos validar el enlace. Puede haber caducado.");
      window.setTimeout(() => navigate("/login", { replace: true }), 2500);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <SEO title="Confirmando | IX LTR" description="Validando tu sesión." />
      <div className="relative z-10 w-full max-w-sm space-y-6 text-center">
        <LtrLogo variant="platform" className="mx-auto h-12 w-auto" />
        <div className="mx-auto h-0.5 w-8 bg-[#FFCD05]" />
        <h1 className="font-heading text-xl font-semibold text-[#FFCD05] uppercase tracking-[0.08em]">
          {status === "working" ? "Un momento" : "Enlace inválido"}
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === "working" && (
          <div className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/2 animate-pulse bg-primary" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
