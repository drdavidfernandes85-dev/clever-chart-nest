import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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

const BodySchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(255),
  preferred_language: z
    .union([z.literal("en"), z.literal("es"), z.literal("pt-BR"), z.literal("pt")])
    .optional(),
});

const normalizeLanguage = (value: unknown) => {
  if (value === "en" || value === "es" || value === "pt-BR") return value;
  if (value === "pt") return "pt-BR";
  return "es";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: parsed.error.flatten().fieldErrors });
  }
  const { user_id: userId, email } = parsed.data;
  const preferredLanguage = normalizeLanguage(parsed.data.preferred_language);

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