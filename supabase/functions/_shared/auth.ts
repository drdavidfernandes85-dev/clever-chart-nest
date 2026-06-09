// Shared helpers for verifying a Supabase JWT in edge functions.
// Use `requireUser(req)` at the top of any function that requires auth.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface AuthedUser {
  id: string;
  email: string | null;
  role: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function unauthorized(message = "Unauthorized"): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Verify the bearer JWT on the incoming request.
 * Returns the authenticated user, or a Response that should be returned
 * directly to the caller on failure.
 */
export async function requireUser(req: Request): Promise<AuthedUser | Response> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return unauthorized("Missing bearer token");
  }
  const token = authHeader.slice(7).trim();
  if (!token) return unauthorized("Empty token");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // getClaims verifies the JWT signature and returns the claims.
  // Falls back to getUser() if the SDK version doesn't expose getClaims.
  // deno-lint-ignore no-explicit-any
  const anyAuth: any = supabase.auth;
  if (typeof anyAuth.getClaims === "function") {
    const { data, error } = await anyAuth.getClaims(token);
    if (error || !data?.claims?.sub) return unauthorized("Invalid token");
    return {
      id: data.claims.sub as string,
      email: (data.claims.email as string) ?? null,
      role: (data.claims.role as string) ?? null,
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return unauthorized("Invalid token");
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: data.user.role ?? null,
  };
}
