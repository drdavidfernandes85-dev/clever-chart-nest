// Forced live-Trading-Layer positions lookup, used as the AUTHORITATIVE source
// for whether a confirmed MT5 ticket exists before a close mutation is dispatched.
//
// The local `mt_positions` table is a cache/mirror only. It MUST NOT be the sole
// authority for blocking a risk-reducing close on a lifecycle-confirmed ticket.
// This module is the dedicated bridge for "go straight to Trading Layer right now,
// then repair the mirror".
//
// Public surface intentionally small:
//   - fetchTradingLayerLivePositions(accountId): forced GET /accounts/{id}/positions
//   - findLivePositionByTicket(positions, ticket): exact ticket match
//   - upsertMirrorFromLive(supabase, userId, accountUuid, livePosition): self-heal mt_positions
//
// Used by close-position-controlled and by the admin Mirror Diagnostic.

const BASE_URL = "https://api.trading-layer.com";

export interface LiveTlPosition {
  ticket: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number | null;
  profit: number | null;
  openedAt: string | null;
  raw: any;
}

export interface LiveLookupResult {
  ok: boolean;
  httpStatus: number;
  positions: LiveTlPosition[];
  fetchedAt: string;
  source: string;
  error?: string | null;
}

function tlKey(): string {
  const k = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!k) throw new Error("TRADING_LAYER_API_KEY missing");
  return k;
}

function normaliseSide(s: any): "buy" | "sell" | null {
  const v = String(s ?? "").toLowerCase();
  if (v === "buy" || v === "0" || v === "long") return "buy";
  if (v === "sell" || v === "1" || v === "short") return "sell";
  return null;
}

function normalisePosition(p: any): LiveTlPosition | null {
  const ticket = p?.ticket != null ? String(p.ticket)
                : p?.position != null ? String(p.position)
                : p?.id != null ? String(p.id)
                : null;
  if (!ticket) return null;
  const side = normaliseSide(p?.side ?? p?.type);
  const symbol = String(p?.symbol ?? p?.brokerSymbol ?? "").toUpperCase();
  const volume = Number(p?.volume ?? p?.lots ?? 0);
  if (!side || !symbol || !Number.isFinite(volume) || volume <= 0) return null;
  return {
    ticket,
    symbol,
    side,
    volume,
    openPrice: Number.isFinite(Number(p?.openPrice ?? p?.price_open ?? p?.price)) ? Number(p?.openPrice ?? p?.price_open ?? p?.price) : null,
    profit: Number.isFinite(Number(p?.profit)) ? Number(p?.profit) : null,
    openedAt: p?.openTime ?? p?.time ?? p?.opened_at ?? null,
    raw: p,
  };
}

/**
 * Forced fresh fetch of live MT5 positions for a Trading Layer accountId.
 * NEVER uses cache. Caller must treat this as the close-authority truth.
 */
export async function fetchTradingLayerLivePositions(
  accountId: string,
): Promise<LiveLookupResult> {
  const url = `${BASE_URL}/api/v1/accounts/${encodeURIComponent(accountId)}/positions?limit=200`;
  const fetchedAt = new Date().toISOString();
  let r: Response | null = null;
  let text = "";
  try {
    r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tlKey()}`,
        "Content-Type": "application/json",
      },
    });
    text = await r.text();
  } catch (e) {
    return {
      ok: false,
      httpStatus: 0,
      positions: [],
      fetchedAt,
      source: "trading_layer_positions_forced",
      error: `network:${e instanceof Error ? e.message : String(e)}`,
    };
  }
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { parsed = { rawText: text }; }
  if (!r.ok) {
    return {
      ok: false,
      httpStatus: r.status,
      positions: [],
      fetchedAt,
      source: "trading_layer_positions_forced",
      error: `tl_positions_${r.status}`,
    };
  }
  const raw = Array.isArray(parsed?.data) ? parsed.data
            : Array.isArray(parsed?.positions) ? parsed.positions
            : Array.isArray(parsed) ? parsed : [];
  const positions = (raw as any[]).map(normalisePosition).filter((p): p is LiveTlPosition => !!p);
  return { ok: true, httpStatus: r.status, positions, fetchedAt, source: "trading_layer_positions_forced" };
}

export function findLivePositionByTicket(
  positions: LiveTlPosition[],
  ticket: string,
): LiveTlPosition | null {
  const want = String(ticket);
  return positions.find((p) => p.ticket === want) ?? null;
}

/**
 * Self-heal the mt_positions mirror from an authoritative live row.
 * Best-effort; failures are swallowed and surfaced via the returned status.
 */
export async function upsertMirrorFromLive(
  supabase: any,
  args: {
    userId: string;
    accountUuid: string;
    live: LiveTlPosition;
    brokerSymbol?: string | null;
  },
): Promise<{ ok: boolean; action: "inserted" | "updated" | "skipped" | "failed"; error?: string }>
{
  try {
    const { data: existing } = await supabase
      .from("mt_positions")
      .select("id")
      .eq("user_id", args.userId)
      .eq("ticket", args.live.ticket)
      .maybeSingle();
    const payload = {
      user_id: args.userId,
      account_id: args.accountUuid,
      ticket: args.live.ticket,
      symbol: args.live.symbol,
      broker_symbol: args.brokerSymbol ?? args.live.symbol,
      side: args.live.side,
      volume: args.live.volume,
      open_price: args.live.openPrice ?? 0,
      profit: args.live.profit ?? 0,
      opened_at: args.live.openedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await supabase.from("mt_positions").update(payload).eq("id", existing.id);
      if (error) return { ok: false, action: "failed", error: error.message };
      return { ok: true, action: "updated" };
    }
    const { error } = await supabase.from("mt_positions").insert(payload);
    if (error) return { ok: false, action: "failed", error: error.message };
    return { ok: true, action: "inserted" };
  } catch (e) {
    return { ok: false, action: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Authoritative close-precondition resolver. Verifies the requested ticket
 * exists live on Trading Layer AND that its attributes match the lifecycle
 * evidence. Local mirror is repaired but is never the authority.
 *
 * Returns a discriminated result the caller maps to one of the new error codes:
 *   - LIVE_POSITION_CONFIRMED_FOR_CLOSE
 *   - LIVE_POSITION_NOT_FOUND_FOR_CLOSE
 *   - CONTROLLED_CLOSE_TICKET_MISMATCH
 *   - CONTROLLED_CLOSE_POSITION_ATTRIBUTES_MISMATCH
 *   - POSITION_MIRROR_STALE_REPAIRED_FROM_LIVE_SOURCE
 *   - POSITION_MIRROR_STALE_LIVE_POSITION_NOT_FOUND
 *   - LIVE_LOOKUP_FAILED
 */
export type CloseAuthorityCode =
  | "LIVE_POSITION_CONFIRMED_FOR_CLOSE"
  | "LIVE_POSITION_NOT_FOUND_FOR_CLOSE"
  | "CONTROLLED_CLOSE_TICKET_MISMATCH"
  | "CONTROLLED_CLOSE_POSITION_ATTRIBUTES_MISMATCH"
  | "POSITION_MIRROR_STALE_REPAIRED_FROM_LIVE_SOURCE"
  | "POSITION_MIRROR_STALE_LIVE_POSITION_NOT_FOUND"
  | "LIVE_LOOKUP_FAILED";

export interface CloseAuthorityRequest {
  requestedTicket: string;
  expectedTicket?: string | null;     // lifecycle confirmed ticket (when applicable)
  expectedBrokerSymbol: string;
  expectedSide: "buy" | "sell";       // OPEN side (close side is opposite)
  expectedVolume: number;
}

export interface CloseAuthorityResult {
  allowed: boolean;
  code: CloseAuthorityCode;
  live: LiveLookupResult;
  livePosition: LiveTlPosition | null;
  mirrorAction?: "inserted" | "updated" | "skipped" | "failed" | "not_attempted";
  detail?: string;
}

export function evaluateCloseAuthority(
  live: LiveLookupResult,
  req: CloseAuthorityRequest,
): { code: CloseAuthorityCode; livePosition: LiveTlPosition | null; detail?: string } {
  if (!live.ok) {
    return { code: "LIVE_LOOKUP_FAILED", livePosition: null, detail: live.error ?? `tl_status_${live.httpStatus}` };
  }
  if (req.expectedTicket && req.requestedTicket !== req.expectedTicket) {
    return { code: "CONTROLLED_CLOSE_TICKET_MISMATCH", livePosition: null,
      detail: `requested=${req.requestedTicket} expected=${req.expectedTicket}` };
  }
  const match = findLivePositionByTicket(live.positions, req.requestedTicket);
  if (!match) {
    return { code: "LIVE_POSITION_NOT_FOUND_FOR_CLOSE", livePosition: null };
  }
  const symOk = match.symbol === req.expectedBrokerSymbol.toUpperCase();
  const sideOk = match.side === req.expectedSide;
  const volOk = Math.abs(match.volume - req.expectedVolume) < 1e-8 || match.volume >= req.expectedVolume - 1e-8;
  if (!symOk || !sideOk || !volOk) {
    return {
      code: "CONTROLLED_CLOSE_POSITION_ATTRIBUTES_MISMATCH",
      livePosition: match,
      detail: `live=${match.symbol} ${match.side} ${match.volume} | expected=${req.expectedBrokerSymbol} ${req.expectedSide} ${req.expectedVolume}`,
    };
  }
  return { code: "LIVE_POSITION_CONFIRMED_FOR_CLOSE", livePosition: match };
}
