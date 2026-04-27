import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** True while we're determining the initial session. Components should NEVER redirect while loading. */
  loading: boolean;
  /** True once the initial getSession() resolved (success OR null). Use this to gate redirects. */
  ready: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  ready: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const DEV = import.meta.env.DEV;
const log = (...args: unknown[]) => {
  if (DEV) console.log("[auth]", ...args);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a single row with graceful 429 backoff + abort on auth errors.
 * Avoids the cascading-retry storm that triggers token refresh storms.
 */
async function fetchProfileSafe(userId: string, signal: { aborted: boolean }): Promise<Profile | null> {
  const maxAttempts = 3;
  let delay = 600;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal.aborted) return null;
    const { data, error, status } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error) return (data as Profile | null) ?? null;

    // 401/403: session not yet valid — bail (do not loop)
    if (status === 401 || status === 403) {
      log("profile fetch 401/403 — aborting", error.message);
      return null;
    }
    // 429: backoff
    if (status === 429 && attempt < maxAttempts) {
      log(`profile fetch 429 — backoff ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      await sleep(delay);
      delay *= 2;
      continue;
    }
    log("profile fetch error", status, error.message);
    return null;
  }
  return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  // Refs prevent stale closures and duplicate work
  const profileInflight = useRef<string | null>(null);
  const refreshFailures = useRef(0);
  const expiredToastShown = useRef(false);

  const applySession = (s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    if (!s?.user) setProfile(null);
  };

  const loadProfile = async (userId: string) => {
    if (profileInflight.current === userId) return; // dedupe
    profileInflight.current = userId;
    const aborted = { aborted: false };
    try {
      const p = await fetchProfileSafe(userId, aborted);
      // Only set if still the same user
      if (profileInflight.current === userId) setProfile(p);
    } finally {
      if (profileInflight.current === userId) profileInflight.current = null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // 1) Subscribe FIRST so we never miss a transition during initial load
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      log("event:", event, "hasSession:", !!s);

      // Reset failure counter on successful refresh / sign-in
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        refreshFailures.current = 0;
        expiredToastShown.current = false;
      }

      // Detect repeated refresh failures (Supabase emits SIGNED_OUT when refresh fails)
      if (event === "SIGNED_OUT" && session) {
        refreshFailures.current += 1;
        if (refreshFailures.current >= 3 && !expiredToastShown.current) {
          expiredToastShown.current = true;
          toast.error("Session expired. Please log in again.");
        }
      }

      applySession(s);

      if (s?.user) {
        // Defer to avoid running async work inside the auth callback (deadlock-safe)
        setTimeout(() => {
          if (mounted) loadProfile(s.user.id);
        }, 0);
      }

      // Mark loading false on first event too (covers cases where getSession is slow)
      if (loading) setLoading(false);
      if (!ready) setReady(true);
    });

    // 2) Then restore the existing session from storage
    supabase.auth
      .getSession()
      .then(({ data: { session: s }, error }) => {
        if (!mounted) return;
        if (error) log("getSession error:", error.message);
        applySession(s);
        if (s?.user) {
          setTimeout(() => {
            if (mounted) loadProfile(s.user.id);
          }, 0);
        }
      })
      .catch((e) => log("getSession threw:", e))
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
        setReady(true);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    refreshFailures.current = 0;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, ready, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
