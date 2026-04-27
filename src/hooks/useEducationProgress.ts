import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type EducationProgress = {
  completed: Set<string>;
  loading: boolean;
  totalXp: number;
  refresh: () => Promise<void>;
  complete: (slug: string) => Promise<{
    already_completed: boolean;
    new_badges: string[];
    xp_awarded?: number;
    percent?: number;
  } | null>;
  uncomplete: (slug: string) => Promise<void>;
};

export function useEducationProgress(totalModules: number): EducationProgress {
  const { user } = useAuth();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [totalXp, setTotalXp] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCompleted(new Set());
      setTotalXp(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: rows }, { data: xp }] = await Promise.all([
      supabase
        .from("education_modules_completed")
        .select("module_slug, xp_awarded")
        .eq("user_id", user.id),
      supabase.from("user_xp").select("total_xp").eq("user_id", user.id).maybeSingle(),
    ]);
    setCompleted(new Set((rows ?? []).map((r) => r.module_slug)));
    setTotalXp(xp?.total_xp ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const complete = useCallback(
    async (slug: string) => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("complete_education_module", {
        _module_slug: slug,
      });
      if (error) {
        console.error(error);
        return null;
      }
      await refresh();
      return data as {
        already_completed: boolean;
        new_badges: string[];
        xp_awarded?: number;
        percent?: number;
      };
    },
    [user, refresh]
  );

  const uncomplete = useCallback(
    async (slug: string) => {
      if (!user) return;
      await supabase.rpc("uncomplete_education_module", { _module_slug: slug });
      await refresh();
    },
    [user, refresh]
  );

  // Suppress unused warning
  void totalModules;

  return { completed, loading, totalXp, refresh, complete, uncomplete };
}
