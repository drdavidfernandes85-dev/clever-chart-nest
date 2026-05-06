import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeLanguage = (value: unknown) => {
  if (value === "en" || value === "es" || value === "pt-BR") return value;
  if (value === "pt") return "pt-BR";
  return "es";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const preferredLanguage = normalizeLanguage(body?.preferred_language);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return json(400, { error: "Invalid user_id" });
  }
  if (!email || !email.includes("@")) return json(400, { error: "Invalid email" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  const authUser = authData?.user;

  if (authError || !authUser) {
    console.error("log-user-signup: auth user lookup failed", authError?.message);
    return json(404, { error: "User not found" });
  }

  if ((authUser.email ?? "").toLowerCase() !== email) {
    return json(403, { error: "Email does not match user" });
  }

  const createdAt = new Date(authUser.created_at).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > 30 * 60 * 1000) {
    return json(403, { error: "Signup is too old to log from this endpoint" });
  }

  const { data: existing, error: existingError } = await supabase
    .from("user_signups")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    console.error("log-user-signup: existing signup lookup failed", existingError.message);
    return json(500, { error: "Could not verify signup status" });
  }

  if (existing) return json(200, { ok: true, already_logged: true });

  const { error: insertError } = await supabase.from("user_signups").insert({
    user_id: userId,
    email,
    preferred_language: preferredLanguage,
  });

  if (insertError) {
    console.error("log-user-signup: insert failed", insertError.message);
    return json(500, { error: "Could not log signup" });
  }

  return json(200, { ok: true });
});