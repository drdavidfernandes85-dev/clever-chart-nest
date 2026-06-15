import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountState = "active" | "grace" | "locked" | "balance_unknown";
export type Feature =
  | "webinars"
  | "terminal_live"
  | "community"
  | "signals"
  | "journal"
  | "leaderboard"
  | "follow_notify";

export interface Entitlements {
  user_id: string;
  account_state: AccountState;
  grace_started_at: string | null;
  grace_lock_at: string | null;
  balance_usd: number | null;
  balance_known: boolean;
  balance_age_seconds: number | null;
  mt_connected: boolean;
  country_of_residence: string | null;
  entitlements: Record<Feature, boolean>;
  notify_topup?: boolean;
  transitioned_from?: string | null;
}

/**
 * Server-side resolved entitlements. The UI must REFLECT — never gate — these.
 * RLS on the database enforces the same decisions independently.
 */
export function useEntitlements() {
  return useQuery({
    queryKey: ["entitlements"],
    queryFn: async (): Promise<Entitlements> => {
      const { data, error } = await supabase.functions.invoke("resolve-entitlements", {
        body: {},
      });
      if (error) throw error;
      return data as Entitlements;
    },
    staleTime: 60_000, // 1 min — server is source of truth, periodic cron also runs
    refetchOnWindowFocus: true,
  });
}

export function useFeatureAllowed(feature: Feature): boolean | undefined {
  const { data } = useEntitlements();
  return data?.entitlements?.[feature];
}
