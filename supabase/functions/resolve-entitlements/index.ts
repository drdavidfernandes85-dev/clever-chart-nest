// Server-side entitlements resolver.
// The client must only REFLECT what this function decides.
//
// Reads:
//   - profiles.country_of_residence (KYC-sourced; NULL = no jurisdiction restriction yet)
//   - user_mt_accounts -> MT5 connection status
//   - tl_account_cache -> per-member Trading Layer balance (NEVER MetaAPI for per-member reads)
// Writes:
//   - profiles.account_state via resolve_account_state(...)
//   - notification_outbox rows (in-app + email + whatsapp + telegram) on active->grace transition

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BALANCE_MAX_AGE_MIN = 10;
const FEATURES = [
  "webinars",
  "terminal_live",
  "community",
  "signals",
  "journal",
  "leaderboard",
  "follow_notify",
] as const;
type Feature = typeof FEATURES[number];

interface ResolveResult {
  user_id: string;
  account_state: "active" | "grace" | "locked" | "balance_unknown";
  grace_started_at: string | null;
  grace_lock_at: string | null;
  balance_usd: number | null;
  balance_known: boolean;
  balance_age_seconds: number | null;
  mt_connected: boolean;
  country_of_residence: string | null;
  entitlements: Record<Feature, boolean>;
  transitioned_from?: string | null;
  notify_topup: boolean;
}

export async function resolveForUser(userId: string): Promise<ResolveResult> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. MT5 connection
  const { data: mt } = await admin
    .from("user_mt_accounts")
    .select("id, status, trading_layer_trader_id, account_type")
    .eq("user_id", userId)
    .eq("platform", "mt5")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  const mtConnected = !!mt;

  // 2. Balance from TL cache (per-member; freshness guarded)
  let balance: number | null = null;
  let balanceKnown = false;
  let balanceAge: number | null = null;
  if (mt?.trading_layer_trader_id) {
    const { data: cache } = await admin
      .from("tl_account_cache")
      .select("account_data, account_updated_at")
      .eq("user_id", userId)
      .eq("trader_id", mt.trading_layer_trader_id)
      .maybeSingle();
    if (cache?.account_updated_at) {
      balanceAge = Math.floor(
        (Date.now() - new Date(cache.account_updated_at).getTime()) / 1000,
      );
      if (balanceAge <= BALANCE_MAX_AGE_MIN * 60) {
        const rawBalance =
          (cache.account_data as any)?.balance ??
          (cache.account_data as any)?.Balance ??
          null;
        if (typeof rawBalance === "number" && isFinite(rawBalance)) {
          balance = rawBalance;
          balanceKnown = true;
        }
      }
    }
  }

  // 3. State machine (only call when MT is actually connected, otherwise leave as-is
  //    and let MT-disconnected users see balance_unknown / no entitlements).
  let transitionedFrom: string | null = null;
  let notifyTopup = false;
  let newState: ResolveResult["account_state"] = "balance_unknown";

  if (mtConnected) {
    const { data: rpc, error } = await admin.rpc("resolve_account_state", {
      _user_id: userId,
      _balance: balance ?? 0,
      _balance_known: balanceKnown,
      _max_age_minutes: BALANCE_MAX_AGE_MIN,
      _source: "trading_layer",
    });
    if (error) throw new Error("resolve_account_state failed: " + error.message);
    const r = rpc as any;
    newState = r.new_state;
    transitionedFrom = r.transition ? r.prev_state : null;
    notifyTopup = !!r.notify_topup;

    if (notifyTopup) {
      await enqueueTopupNotification(admin, userId, r.grace_lock_at);
    }
  } else {
    // Read current persisted state without changing it
    const { data: p } = await admin
      .from("profiles")
      .select("account_state, grace_started_at, country_of_residence")
      .eq("user_id", userId)
      .maybeSingle();
    newState = (p?.account_state as any) ?? "balance_unknown";
  }

  // 4. Country + jurisdiction flags
  const { data: profile } = await admin
    .from("profiles")
    .select("country_of_residence, grace_started_at")
    .eq("user_id", userId)
    .maybeSingle();

  const country = profile?.country_of_residence ?? null;
  const flagRows = country
    ? (await admin
        .from("feature_flags_by_country")
        .select("feature, enabled")
        .eq("country_code", country)).data ?? []
    : [];
  const countryDisabled = new Set(
    flagRows.filter((r: any) => r.enabled === false).map((r: any) => r.feature),
  );

  // 5. Compose entitlements (mirrors has_entitlement SQL logic)
  const baseUnlocked = newState !== "locked";
  const ent: Record<Feature, boolean> = {
    webinars: true, // always
    terminal_live: mtConnected && baseUnlocked,
    community: mtConnected && baseUnlocked,
    signals: mtConnected && baseUnlocked,
    journal: mtConnected && baseUnlocked,
    leaderboard: baseUnlocked,
    follow_notify:
      mtConnected && baseUnlocked && !countryDisabled.has("follow_notify"),
  };

  return {
    user_id: userId,
    account_state: newState,
    grace_started_at: profile?.grace_started_at ?? null,
    grace_lock_at: null,
    balance_usd: balance,
    balance_known: balanceKnown,
    balance_age_seconds: balanceAge,
    mt_connected: mtConnected,
    country_of_residence: country,
    entitlements: ent,
    transitioned_from: transitionedFrom,
    notify_topup: notifyTopup,
  };
}

async function enqueueTopupNotification(
  admin: ReturnType<typeof createClient>,
  userId: string,
  graceLockAt: string | null,
) {
  const dedupBase = `topup:${userId}:${graceLockAt ?? "nodate"}`;
  const payload = {
    event: "balance_below_min",
    grace_lock_at: graceLockAt,
    i18n_keys: {
      title: "notif.topup.title",
      body: "notif.topup.body",
    },
  };
  const rows = ["inapp", "email", "whatsapp", "telegram"].map((channel) => ({
    user_id: userId,
    channel,
    event_key: "balance_below_min",
    payload,
    dedup_key: `${dedupBase}:${channel}`,
  }));
  // ignore dup-key conflicts (idempotent)
  await admin.from("notification_outbox").upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: true });

  // Also drop an in-app notification users will see immediately.
  await admin.from("notifications").insert({
    user_id: userId,
    kind: "topup_required",
    title: "notif.topup.title",
    body: "notif.topup.body",
    link: "/connect-mt",
    ref_id: null,
  }).then(() => {}, () => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await userClient.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = data.claims.sub as string;
    const result = await resolveForUser(userId);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
