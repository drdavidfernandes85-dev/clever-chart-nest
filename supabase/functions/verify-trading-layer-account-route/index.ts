// verify-trading-layer-account-route
// Read-only identity verification for a user's Trading Layer account route.
// Compares both candidate ids (trading_layer_trader_id and
// trading_layer_account_id) against the connected MT5 login/server, and
// persists the verified route on user_mt_accounts when exactly one candidate
// matches both.
//
// Never mutates Trading Layer. Never returns secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getAccountInfo } from "../_shared/tlClient.ts";
import { interpretTradeMode } from "../_shared/tradingLayerTradeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const mask = (v: string | null | undefined) =>
  !v ? null : v.length <= 12 ? v : `${v.slice(0, 8)}…${v.slice(-4)}`;

const normLogin = (v: unknown) =>
  v == null ? null : String(v).trim().replace(/^0+/, "");
const normServer = (v: unknown) =>
  v == null ? null : String(v).trim().toLowerCase();

interface CandidateReport {
  label: "trader_route" | "stored_account_route";
  id: string;
  idMasked: string | null;
  httpStatus: number;
  ok: boolean;
  error?: string | null;
  login: string | number | null;
  server: string | null;
  currency: string | null;
  tradeAllowed: boolean | null;
  tradeModeRaw: number | null;
  tradeModeLabel: string | null;
  identityMatchesExpectedLogin: boolean;
  identityMatchesExpectedServer: boolean;
  identityMatch: boolean;
  executionAllowed: boolean;
  useForExecution: boolean;
  routeStatus:
    | "identity_match_execution_allowed_pending_symbol_verification"
    | "identity_match_execution_blocked"
    | "identity_mismatch"
    | "unavailable";
  reason: string;
  matches: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  if (!Deno.env.get("TRADING_LAYER_API_KEY")) {
    return json({ success: false, error: "Missing TRADING_LAYER_API_KEY" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supaUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supa = createClient(supabaseUrl, serviceKey);

  const { data: userData } = await supaUser.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return json({ success: false, error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const localMtAccountId: string | null =
    typeof body?.localMtAccountId === "string" ? body.localMtAccountId : null;
  const targetUserId: string | null =
    typeof body?.targetUserId === "string" ? body.targetUserId : null;

  // Admin override
  let resolveUid = uid;
  if (targetUserId && targetUserId !== uid) {
    const { data: isAdmin } = await supa.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (isAdmin === true) resolveUid = targetUserId;
    else return json({ success: false, error: "Forbidden" }, 403);
  }

  // Resolve the MT account row
  let q = supa.from("user_mt_accounts")
    .select("id, user_id, login, server_name, trading_layer_trader_id, trading_layer_account_id, credential_status, mapping_status")
    .eq("user_id", resolveUid);
  if (localMtAccountId) q = q.eq("id", localMtAccountId);
  const { data: rows } = await q.order("last_verified_at", { ascending: false, nullsFirst: false }).limit(10);
  const row = (rows ?? [])[0];
  if (!row) return json({ success: false, error: "No connected MT account." }, 404);

  const expectedLogin = normLogin(row.login);
  const expectedServer = normServer(row.server_name);

  const candidates: { label: CandidateReport["label"]; id: string }[] = [];
  if (row.trading_layer_trader_id) {
    candidates.push({ label: "trader_route", id: String(row.trading_layer_trader_id) });
  }
  if (row.trading_layer_account_id && row.trading_layer_account_id !== row.trading_layer_trader_id) {
    candidates.push({ label: "stored_account_route", id: String(row.trading_layer_account_id) });
  }
  if (candidates.length === 0) {
    return json({ success: false, error: "No Trading Layer route ids stored on this account." }, 409);
  }

  const reports: CandidateReport[] = [];
  for (const c of candidates) {
    const r = await getAccountInfo(c.id);
    const d = r.data;
    const retLogin = normLogin(d?.login);
    const retServer = normServer(d?.server);
    const matchLogin = !!(expectedLogin && retLogin && expectedLogin === retLogin);
    const matchServer = !!(expectedServer && retServer && expectedServer === retServer);
    reports.push({
      label: c.label,
      id: c.id,
      idMasked: mask(c.id),
      httpStatus: r.status,
      ok: r.ok,
      error: r.error ?? null,
      login: d?.login ?? null,
      server: d?.server ?? null,
      currency: d?.currency ?? null,
      tradeAllowed: d?.trade_allowed ?? null,
      tradeModeRaw: d?.trade_mode ?? null,
      tradeModeLabel: interpretTradeMode(d?.trade_mode ?? null).label,
      identityMatchesExpectedLogin: matchLogin,
      identityMatchesExpectedServer: matchServer,
      matches: matchLogin && matchServer,
    });
  }

  const winners = reports.filter((r) => r.matches);
  let verifiedRouteId: string | null = null;
  let verified = false;
  if (winners.length === 1) {
    const w = winners[0];
    verifiedRouteId = w.id;
    verified = true;
    await supa
      .from("user_mt_accounts")
      .update({
        account_route_verified: true,
        account_route_verified_at: new Date().toISOString(),
        account_route_mt5_login: String(w.login ?? ""),
        account_route_mt5_server: w.server,
        trading_layer_account_route_id: w.id,
        account_route_verification_evidence: {
          expectedLogin,
          expectedServer,
          reports: reports.map((r) => ({ ...r, id: undefined })),
          checkedAt: new Date().toISOString(),
        },
      })
      .eq("id", row.id);
  }

  return json({
    success: true,
    localMtAccountId: row.id,
    expected: {
      mt5Login: expectedLogin,
      mt5Server: row.server_name ?? null,
    },
    candidates: reports,
    verified,
    verifiedRouteId,
    verifiedRouteIdMasked: mask(verifiedRouteId),
    blocker: verified
      ? null
      : "Trading Layer account route must be verified against the connected MT5 login/server before broker symbols can be used for execution.",
  });
});
