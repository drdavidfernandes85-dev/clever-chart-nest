// Read-only EURUSD flatness diagnostic for the Final Platform Lifecycle Validation card.
// NEVER submits a trade, close, modify or cancel. NEVER creates an authorisation.
// Calls Trading Layer GET /accounts/{traderId}/positions and /orders, filters EURUSD,
// and reports residual exposure + incident-ticket status. Admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { fetchTradingLayerLivePositions } from "../_shared/livePositions.ts";

const VERSION = "ADMIN_EURUSD_FLATNESS_DIAGNOSTIC_V1_2026_05_28";
const TL_BASE = "https://api.trading-layer.com";
const INCIDENT_TICKET = "1169128468";
const EURUSD = "EURUSD";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const TL_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!TL_KEY) return json({ success: false, version: VERSION, error: "Missing TRADING_LAYER_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, version: VERSION, error: "Unauthorized" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ success: false, version: VERSION, error: "Unauthorized" }, 401);

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ success: false, version: VERSION, error: "Forbidden" }, 403);

  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (!mapping?.traderId) {
    return json({ success: false, version: VERSION, error: "No verified TL mapping for admin tester" }, 404);
  }
  const traderId = mapping.traderId;

  const checkedAt = new Date().toISOString();

  // Positions (forced live)
  const live = await fetchTradingLayerLivePositions(traderId);
  if (!live.ok) {
    return json({
      success: false, version: VERSION,
      error: "tl_positions_lookup_failed",
      detail: live.error, httpStatus: live.httpStatus, checkedAt,
    }, 502);
  }

  // Pending orders (forced live)
  let ordersOk = false;
  let ordersHttp = 0;
  let orders: any[] = [];
  let ordersErr: string | null = null;
  try {
    const r = await fetch(`${TL_BASE}/api/v1/accounts/${encodeURIComponent(traderId)}/orders?limit=100`, {
      headers: { Authorization: `Bearer ${TL_KEY}`, "Content-Type": "application/json" },
    });
    ordersHttp = r.status;
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    if (r.ok) {
      ordersOk = true;
      const raw = Array.isArray(parsed?.data) ? parsed.data
                : Array.isArray(parsed?.orders) ? parsed.orders
                : Array.isArray(parsed) ? parsed : [];
      orders = raw;
    } else {
      ordersErr = `tl_orders_${r.status}`;
    }
  } catch (e) {
    ordersErr = e instanceof Error ? e.message : String(e);
  }

  const eurusdPositions = live.positions
    .filter((p) => p.symbol.toUpperCase() === EURUSD)
    .map((p) => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume }));

  const eurusdOrders = (orders ?? [])
    .map((o: any) => ({
      ticket: o?.ticket != null ? String(o.ticket) : o?.id != null ? String(o.id) : null,
      symbol: String(o?.symbol ?? o?.brokerSymbol ?? "").toUpperCase(),
      side: String(o?.side ?? o?.type ?? "").toLowerCase(),
      volume: Number(o?.volume ?? o?.lots ?? 0),
      type: o?.type ?? null,
    }))
    .filter((o) => o.ticket && o.symbol === EURUSD);

  const incidentOpen = live.positions.some((p) => p.ticket === INCIDENT_TICKET);
  const residualExposure = eurusdPositions.length > 0 || eurusdOrders.length > 0 || incidentOpen;
  const retestEligible = !residualExposure && ordersOk;

  return json({
    success: true,
    version: VERSION,
    checkedAt,
    source: "trading_layer_live_forced",
    route: { brokerSymbol: EURUSD, traderId, login: mapping.login ?? null },
    positions: {
      totalCount: live.positions.length,
      eurusdCount: eurusdPositions.length,
      eurusd: eurusdPositions,
    },
    orders: {
      lookupOk: ordersOk,
      httpStatus: ordersHttp,
      error: ordersErr,
      eurusdCount: eurusdOrders.length,
      eurusd: eurusdOrders,
    },
    incident: {
      ticket: INCIDENT_TICKET,
      currentlyOpen: incidentOpen,
    },
    residualEurusdExposure: residualExposure ? "detected" : "none",
    retestEligibleForAuthorisation: retestEligible,
    mutationsPerformed: false,
  });
});
