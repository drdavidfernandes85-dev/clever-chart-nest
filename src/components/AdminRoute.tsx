import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, ready, isRefreshing, refreshAttempted, ensureFreshSession } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    if (ready && !user && !isRefreshing && !refreshAttempted) {
      ensureFreshSession(`admin:${location.pathname}`);
    }
  }, [ready, user, isRefreshing, refreshAttempted, ensureFreshSession, location.pathname]);

  useEffect(() => {
    if (!ready || isRefreshing) return;
    if (!user) { setIsAdmin(false); return; }
    isRedirectingRef.current = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin" as const)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [ready, isRefreshing, user]);

  if (loading || !ready || isRefreshing || (ready && !user && !refreshAttempted) || isAdmin === null) {
    if (isRefreshing && !user) console.log("Redirect prevented during refresh", { path: location.pathname });
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    if (isRedirectingRef.current) return null;
    isRedirectingRef.current = true;
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default AdminRoute;
