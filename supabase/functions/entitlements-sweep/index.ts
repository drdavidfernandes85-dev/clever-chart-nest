// Cron-driven sweep: re-resolves entitlements for every member with a connected MT5,
// so day-7 grace->locked transitions fire and active->grace notifications go out
// even when the member never opens the app.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveForUser } from "../resolve-entitlements/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: accounts, error } = await admin
      .from("user_mt_accounts")
      .select("user_id")
      .eq("platform", "mt5")
      .eq("status", "connected");
    if (error) throw error;

    const userIds = Array.from(new Set((accounts ?? []).map((a: any) => a.user_id)));
    const results: { user_id: string; ok: boolean; error?: string }[] = [];

    // Sequential to keep DB load bounded; switch to bounded-concurrency if needed.
    for (const uid of userIds) {
      try {
        await resolveForUser(uid);
        results.push({ user_id: uid, ok: true });
      } catch (e) {
        results.push({ user_id: uid, ok: false, error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ swept: userIds.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
