import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Gates protected pages on a confirmed session.
 *
 * Robustness rules:
 *  - Never redirect while `loading` or before `ready` (initial getSession).
 *  - After ready+no-user, wait a small grace window so a transient TOKEN_REFRESHED
 *    or SIGNED_OUT->SIGNED_IN handoff doesn't bounce the user to /login.
 *  - Pass the originating path so /login can return the user here without looping.
 */
const GRACE_MS = 800;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, ready, isRefreshing, refreshAttempted, authError, ensureFreshSession } = useAuth();
  const location = useLocation();
  const [graceElapsed, setGraceElapsed] = useState(false);

  useEffect(() => {
    if (ready && !user && !isRefreshing && !refreshAttempted) {
      ensureFreshSession(`protected:${location.pathname}`);
    }
  }, [ready, user, isRefreshing, refreshAttempted, ensureFreshSession, location.pathname]);

  useEffect(() => {
    if (ready && !user && refreshAttempted && !isRefreshing) {
      const t = setTimeout(() => setGraceElapsed(true), GRACE_MS);
      return () => clearTimeout(t);
    }
    setGraceElapsed(false);
  }, [ready, user, refreshAttempted, isRefreshing]);

  if (loading || !ready || isRefreshing || (ready && !user && !refreshAttempted)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(45,100%,50%)] border-t-transparent" />
          <p className="text-xs text-muted-foreground">
            {isRefreshing ? "Reconnecting your session…" : "Restoring your session…"}
          </p>
          {authError && <p className="max-w-xs text-center text-[11px] text-muted-foreground/80">{authError}</p>}
        </div>
      </div>
    );
  }

  if (!user) {
    if (!graceElapsed) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(45,100%,50%)] border-t-transparent" />
        </div>
      );
    }
    // Redirect once with origin in state — Login will return the user here
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
