// compare-route-candidates
// Read-only diagnostic: compares up to N Trading Layer accountId candidates
// for identity (login/server), trade_allowed, trade_mode, and EURUSD / XAUUSD
// / plus-suffix symbol catalogue presence. Never mutates anything. Never
// returns secrets. Never submits orders.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  getAccountInfo,
  getSymbolInfo,
  listSymbols,
  getLatestTick,
} from "../_shared/tlClient.ts";
import { interpretTradeMode } from "../_shared/tradingLayerTradeMode.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const norm = (v: unknown) => (v == null ? null : String(v).trim());
const normLogin = (v: unknown) =>
  v == null ? null : String(v).trim().replace(/^0+/, "");
const normServer = (v: unknown) =>
  v == null ? null : String(v).trim().toLowerCase();

const DEFAULT_CANDIDATES = [
  { label: "A_trader_route", id: "29008868-d583-4ab5-a6c1-57586fe92007" },
  { label: "B_previously_selected_route", id: "559a12e4-16d8-4db3-be48-40fbea54bcfe" },
  { label: "C_tl_provided_symbols_route", id: "10bca1b1-42af-43d2-8ead-3361d4ded4f3" },
];

const EXPECTED_LOGIN = "87943580";
const EXPECTED_SERVER = "infinoxlimited-mt5live";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }
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
  const { data: u } = await supaUser.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: isAdmin } = await supa.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (isAdmin !== true) return json({ success: false, error: "Forbidden" }, 403);

  const candidates = DEFAULT_CANDIDATES;
  const reports: any[] = [];

  for (const c of candidates) {
    const acct = await getAccountInfo(c.id);
    const d = acct.data;
    const matchLogin = normLogin(d?.login) === EXPECTED_LOGIN;
    const matchServer = normServer(d?.server) === EXPECTED_SERVER;

    // Search EURUSD
    const eur = await listSymbols(c.id, { search: "EURUSD", limit: 1000 });
    const xau = await listSymbols(c.id, { search: "XAUUSD", limit: 1000 });
    const allRow = await listSymbols(c.id, { limit: 1000, sort: "name", order: "asc" });
    const allRows = Array.isArray(allRow.data) ? allRow.data : [];
    const plusRows = allRows.filter((r: any) =>
      String(r?.name ?? "").includes("+"),
    );
    const eurNames = (eur.data ?? []).map((r: any) => String(r?.name ?? ""));
    const xauNames = (xau.data ?? []).map((r: any) => String(r?.name ?? ""));

    // If EURUSD+ present, fetch detail + tick
    let eurusdPlusDetail: any = null;
    let eurusdPlusTick: any = null;
    if (eurNames.includes("EURUSD+")) {
      const det = await getSymbolInfo(c.id, "EURUSD+");
      eurusdPlusDetail = det.ok ? det.data : { error: det.error, status: det.status };
      const tk = await getLatestTick(c.id, "EURUSD+");
      eurusdPlusTick = tk.ok
        ? { ok: true, data: tk.data, status: tk.status }
        : { ok: false, status: tk.status, error: tk.error };
    }

    reports.push({
      label: c.label,
      id: c.id,
      account: {
        ok: acct.ok,
        httpStatus: acct.status,
        error: acct.error ?? null,
        login: d?.login ?? null,
        server: d?.server ?? null,
        currency: d?.currency ?? null,
        trade_allowed: d?.trade_allowed ?? null,
        trade_mode_raw: d?.trade_mode ?? null,
        trade_mode_label: interpretTradeMode(d?.trade_mode ?? null).label,
        identity_match_login: matchLogin,
        identity_match_server: matchServer,
        identity_match: matchLogin && matchServer,
      },
      symbols: {
        eurusdSearchHttp: eur.status,
        eurusdSearchOk: eur.ok,
        xauusdSearchHttp: xau.status,
        xauusdSearchOk: xau.ok,
        listAllHttp: allRow.status,
        listAllOk: allRow.ok,
        totalReturned: allRows.length,
        eurusd_variants: eurNames,
        xauusd_variants: xauNames,
        plus_suffix_count: plusRows.length,
        plus_suffix_sample: plusRows.slice(0, 12).map((r: any) => r?.name),
        contains_EURUSD_plus: eurNames.includes("EURUSD+"),
      },
      eurusdPlusDetail,
      eurusdPlusTick,
      executionCandidate:
        acct.ok &&
        matchLogin &&
        matchServer &&
        d?.trade_allowed === true,
    });
  }

  // Build comparison summary
  const summary = reports.map((r) => ({
    candidate: r.label,
    id: r.id,
    trade_allowed: r.account.trade_allowed,
    identity_match: r.account.identity_match,
    eurusd_variants: r.symbols.eurusd_variants,
    xauusd_variants: r.symbols.xauusd_variants,
    plus_suffix_count: r.symbols.plus_suffix_count,
    execution_candidate: r.executionCandidate,
  }));

  // Recommendation
  const matchedExecCandidates = reports.filter(
    (r) =>
      r.executionCandidate &&
      r.symbols.contains_EURUSD_plus,
  );
  let recommendation = "KEEP_BLOCKED";
  let recommendationDetail =
    "No candidate simultaneously matches MT5 login/server, returns trade_allowed=true, and exposes EURUSD+ in its symbols list.";
  if (matchedExecCandidates.length === 1) {
    const w = matchedExecCandidates[0];
    recommendation = "SAFE_TO_PROPOSE_MIGRATION";
    recommendationDetail = `Candidate ${w.label} (${w.id}) matches MT5 identity, returns trade_allowed=true, and exposes EURUSD+. Migration may be PROPOSED — no live order to be submitted as part of this pass.`;
  } else if (matchedExecCandidates.length > 1) {
    recommendation = "AMBIGUOUS_KEEP_BLOCKED";
    recommendationDetail =
      "Multiple candidates match identity + trade_allowed + EURUSD+; manual clarification required.";
  }

  return json({
    success: true,
    policy_version: "ROUTE_CANDIDATE_COMPARE_V1_2026_05_27",
    expected: { mt5Login: EXPECTED_LOGIN, mt5Server: "InfinoxLimited-MT5Live" },
    candidates: reports,
    summary,
    recommendation,
    recommendationDetail,
    constraints: {
      live_order_submitted: false,
      execution_block_cleared: false,
      pending_orders_changed: false,
      risk_or_killswitch_changed: false,
      secrets_exposed: false,
    },
  });
});
