import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
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
  /** True while a single-flight refresh/recovery attempt is running. */
  isRefreshing: boolean;
  /** True after we have attempted to recover/refresh the session at least once. */
  refreshAttempted: boolean;
  authError: string | null;
  ensureFreshSession: (reason?: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  ready: false,
  isRefreshing: false,
  refreshAttempted: false,
  authError: null,
  ensureFreshSession: async () => null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const DEV = import.meta.env.DEV;
const log = (...args: unknown[]) => {
  if (DEV) console.log("[auth]", ...args);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REFRESH_MARGIN_MS = 90_000;
const RATE_LIMIT_BACKOFF_MS = 7_500;
const REFRESH_LOCK_NAME = "ixltr-auth-refresh";

const isRateLimitError = (error: unknown) => {
  const e = error as { message?: string; status?: number; code?: string } | null;
  const text = `${e?.message ?? ""} ${e?.status ?? ""} ${e?.code ?? ""}`;
  return /429|too many|rate.?limit/i.test(text);
};

const isFreshEnough = (s: Session | null, marginMs = REFRESH_MARGIN_MS) => {
  if (!s?.expires_at) return !!s;
  return s.expires_at * 1000 - Date.now() > marginMs;
};

const withRefreshLock = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== "undefined" ? (navigator as any).locks : null;
  if (locks?.request) {
    return locks.request(REFRESH_LOCK_NAME, { mode: "exclusive" }, fn);
  }
  return fn();
};

/**
 * Fetch a single row with graceful 429 backoff + abort on auth errors.
 * Avoids the cascading-retry storm that triggers token refresh storms.
 */
async function fetchProfileSafe(userId: string, signal: { aborted: boolean }): Promise<Profile | null> {
  const maxAttempts = 3;
  let delay = RATE_LIMIT_BACKOFF_MS;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal.aborted) return null;
    const { data, error, status } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, avatar_url")
      .eq("user_id", userId)
      .limit(1);

    if (!error) return ((data as Profile[] | null)?.[0] as Profile | undefined) ?? null;

    // 401/403: session not yet valid — bail (do not loop)
    if (status === 401 || status === 403) {
      log("profile fetch 401/403 — aborting", error.message);
      return null;
    }
    // 429: backoff
    if (status === 429 && attempt < maxAttempts) {
      console.log("Refresh failed with 429 - backing off", { source: "profile", delay });
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Refs prevent stale closures and duplicate work
  const profileInflight = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const refreshPromiseRef = useRef<Promise<Session | null> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const userInitiatedSignOut = useRef(false);
  const refreshFailures = useRef(0);
  const expiredToastShown = useRef(false);

  const applySession = (s: Session | null) => {
    sessionRef.current = s;
    setSession(s);
    setUser(s?.user ?? null);
    if (!s?.user) setProfile(null);
  };

  const ensureFreshSession = useCallback(async (reason = "manual") => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const run = async () => {
      setRefreshAttempted(true);
      const current = sessionRef.current;
      if (isFreshEnough(current)) return current;

      setIsRefreshing(true);
      setAuthError(null);

      try {
        const sinceLastRefresh = Date.now() - lastRefreshAtRef.current;
        if (sinceLastRefresh < 2_500) await sleep(2_500 - sinceLastRefresh);

        return await withRefreshLock(async () => {
          const { data: initial, error: getSessionError } = await supabase.auth.getSession();
          if (getSessionError) log("getSession before refresh error:", getSessionError.message);
          if (isFreshEnough(initial.session)) {
            applySession(initial.session);
            return initial.session;
          }
          if (!initial.session) return null;

          for (let attempt = 1; attempt <= 2; attempt++) {
            const { data, error } = await supabase.auth.refreshSession(initial.session);
            if (!error) {
              console.log("Session refreshed successfully", { reason, attempt });
              refreshFailures.current = 0;
              applySession(data.session);
              return data.session;
            }

            if (isRateLimitError(error)) {
              console.log("Refresh failed with 429 - backing off", { reason, attempt, delay: RATE_LIMIT_BACKOFF_MS });
              if (!expiredToastShown.current) {
                expiredToastShown.current = true;
                toast.info("Session is reconnecting. Please wait a moment…");
              }
              await sleep(RATE_LIMIT_BACKOFF_MS);
              continue;
            }

            setAuthError(error.message);
            log("refreshSession error:", error.message);
            return null;
          }

          setAuthError("Session refresh is rate limited. Please wait a moment and try again.");
          return sessionRef.current;
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to refresh session";
        if (isRateLimitError(e)) {
          console.log("Refresh failed with 429 - backing off", { reason, delay: RATE_LIMIT_BACKOFF_MS });
          await sleep(RATE_LIMIT_BACKOFF_MS);
        }
        setAuthError(message);
        return sessionRef.current;
      } finally {
        lastRefreshAtRef.current = Date.now();
        setIsRefreshing(false);
        refreshPromiseRef.current = null;
      }
    };

    refreshPromiseRef.current = run();
    return refreshPromiseRef.current;
  }, []);

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
      console.log("Current session state on dashboard load", {
        event,
        hasSession: !!s,
        expiresAt: s?.expires_at ?? null,
      });

      // Reset failure counter on successful refresh / sign-in
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        refreshFailures.current = 0;
        expiredToastShown.current = false;
        setAuthError(null);
        setRefreshAttempted(true);
        if (event === "TOKEN_REFRESHED") console.log("Session refreshed successfully", { source: "auth-event" });
      }

      // Detect repeated refresh failures (Supabase emits SIGNED_OUT when refresh fails)
      if (event === "SIGNED_OUT" && sessionRef.current && !userInitiatedSignOut.current) {
        refreshFailures.current += 1;
        if (refreshFailures.current >= 3 && !expiredToastShown.current) {
          expiredToastShown.current = true;
          toast.error("Session expired. Please log in again.");
        }
        setLoading(false);
        setReady(true);
        setRefreshAttempted(false);
        setTimeout(() => {
          if (mounted) {
            ensureFreshSession("signed-out-recovery").then((recovered) => {
              if (mounted && !recovered) applySession(null);
            });
          }
        }, RATE_LIMIT_BACKOFF_MS);
        return;
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
    userInitiatedSignOut.current = true;
    await supabase.auth.signOut();
    setProfile(null);
    refreshFailures.current = 0;
    setRefreshAttempted(false);
    userInitiatedSignOut.current = false;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, ready, isRefreshing, refreshAttempted, authError, ensureFreshSession, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
