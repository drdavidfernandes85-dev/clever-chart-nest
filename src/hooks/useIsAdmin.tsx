import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useIsAdmin = () => {
  const { user, ready, isRefreshing } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || isRefreshing) return;
    if (!user) { setIsAdmin(false); setCheckedUserId(null); setLoading(false); return; }
    if (checkedUserId === user.id) return;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin" as const)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
        setCheckedUserId(user.id);
        setLoading(false);
      });
  }, [ready, isRefreshing, user, checkedUserId]);

  return { isAdmin, loading };
};
