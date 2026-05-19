// Shared backend risk-enforcement helpers used by execution edge functions.
// Imported as a relative module: `import { ... } from "../_shared/risk.ts";`.

export interface RiskSettings {
  live_trading_enabled: boolean;
  kill_switch_enabled: boolean;
  testing_mode_enabled: boolean;
  max_order_volume: number;
  max_close_volume: number;
  max_daily_volume: number;
  max_daily_trades: number;
  max_daily_loss: number;
  allowed_symbols: string[] | null;
  blocked_symbols: string[];
}

export const RISK_DEFAULTS: RiskSettings = {
  live_trading_enabled: true,
  kill_switch_enabled: false,
  testing_mode_enabled: true,
  max_order_volume: 0.01,
  max_close_volume: 0.01,
  max_daily_volume: 0.05,
  max_daily_trades: 5,
  max_daily_loss: 50,
  allowed_symbols: null,
  blocked_symbols: [],
};

export const TESTING_MAX_VOLUME = 0.01;

/** Load (or default) the per-user risk settings row. */
export async function loadRiskSettings(
  supabase: any,
  userId: string,
): Promise<RiskSettings> {
  try {
    const { data } = await supabase
      .from("trading_risk_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { ...RISK_DEFAULTS };
    return {
      live_trading_enabled: data.live_trading_enabled ?? RISK_DEFAULTS.live_trading_enabled,
      kill_switch_enabled: data.kill_switch_enabled ?? RISK_DEFAULTS.kill_switch_enabled,
      testing_mode_enabled: data.testing_mode_enabled ?? RISK_DEFAULTS.testing_mode_enabled,
      max_order_volume: Number(data.max_order_volume ?? RISK_DEFAULTS.max_order_volume),
      max_close_volume: Number(data.max_close_volume ?? RISK_DEFAULTS.max_close_volume),
      max_daily_volume: Number(data.max_daily_volume ?? RISK_DEFAULTS.max_daily_volume),
      max_daily_trades: Number(data.max_daily_trades ?? RISK_DEFAULTS.max_daily_trades),
      max_daily_loss: Number(data.max_daily_loss ?? RISK_DEFAULTS.max_daily_loss),
      allowed_symbols: Array.isArray(data.allowed_symbols) && data.allowed_symbols.length > 0
        ? data.allowed_symbols.map((s: string) => String(s).toUpperCase())
        : null,
      blocked_symbols: Array.isArray(data.blocked_symbols)
        ? data.blocked_symbols.map((s: string) => String(s).toUpperCase())
        : [],
    };
  } catch {
    return { ...RISK_DEFAULTS };
  }
}

export interface DailyUsage {
  trades: number;
  volume: number;
  loss: number;
}

/** Aggregate today's successful executions for the user (UTC day). */
export async function loadDailyUsage(
  supabase: any,
  userId: string,
): Promise<DailyUsage> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  try {
    const { data } = await supabase
      .from("execution_audit_events")
      .select("status,volume,raw")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString());
    if (!Array.isArray(data)) return { trades: 0, volume: 0, loss: 0 };
    let trades = 0, volume = 0, loss = 0;
    for (const r of data) {
      const s = String(r?.status ?? "");
      if (s === "position_confirmed" || s === "placed" || s === "filled") {
        trades += 1;
        volume += Number(r?.volume ?? 0) || 0;
      }
      const pnl = Number((r as any)?.raw?.realizedPnl ?? (r as any)?.raw?.pnl ?? 0);
      if (Number.isFinite(pnl) && pnl < 0) loss += Math.abs(pnl);
    }
    return { trades, volume, loss };
  } catch {
    return { trades: 0, volume: 0, loss: 0 };
  }
}

export interface RiskBlockArgs {
  reason: string;
  rule: string;
  settings: RiskSettings;
  usage?: DailyUsage;
}

/** Build the standard risk-block response body. */
export function buildRiskBlock(version: string, args: RiskBlockArgs, extra: Record<string, unknown> = {}) {
  return {
    success: false,
    version,
    step: "risk_validation",
    status: "blocked",
    classification: "risk_block",
    liveOrderSent: false,
    liveCloseSent: false,
    reason: args.reason,
    ruleViolated: args.rule,
    riskSettings: args.settings,
    dailyUsage: args.usage ?? null,
    ...extra,
  };
}

/** Insert a risk_block audit event (best-effort, never throws). */
export async function auditRiskBlock(
  supabase: any,
  userId: string,
  ctx: {
    tradeId?: string | null;
    symbol: string;
    side: string;
    volume: number;
    reason: string;
    rule: string;
    response: Record<string, unknown>;
    ticket?: string | null;
  },
) {
  try {
    await supabase.from("execution_audit_events").insert({
      user_id: userId,
      trade_id: ctx.tradeId ?? null,
      symbol: ctx.symbol,
      side: ctx.side,
      volume: ctx.volume,
      status: "blocked",
      outcome: "blocked",
      broker_message: ctx.reason,
      reason: ctx.reason,
      rule_violated: ctx.rule,
      ticket: ctx.ticket ?? null,
      raw: { classification: "risk_block", response_payload: ctx.response },
    });
  } catch { /* swallow */ }
}

export interface OpenCheckInput {
  symbol: string;
  volume: number;
}

/** Validate a new open order against risk settings. Returns null if OK, else { reason, rule }. */
export function checkOpenRisk(
  input: OpenCheckInput,
  s: RiskSettings,
  usage: DailyUsage,
): { reason: string; rule: string } | null {
  if (s.kill_switch_enabled) return { reason: "Trading disabled by kill switch.", rule: "kill_switch" };
  if (!s.live_trading_enabled) return { reason: "Live trading is disabled.", rule: "live_trading_disabled" };
  const sym = String(input.symbol).toUpperCase();
  if (s.blocked_symbols.includes(sym)) return { reason: `Symbol ${sym} is blocked.`, rule: "blocked_symbol" };
  if (s.allowed_symbols && !s.allowed_symbols.includes(sym)) {
    return { reason: `Symbol ${sym} is not in the allowed list.`, rule: "symbol_not_allowed" };
  }
  if (input.volume > s.max_order_volume + 1e-9) {
    return { reason: `Order volume ${input.volume} exceeds max ${s.max_order_volume}.`, rule: "max_order_volume" };
  }
  if (s.testing_mode_enabled && input.volume > TESTING_MAX_VOLUME + 1e-9) {
    return { reason: `Testing mode caps volume at ${TESTING_MAX_VOLUME}.`, rule: "testing_mode_cap" };
  }
  if (usage.trades >= s.max_daily_trades) {
    return { reason: `Daily trade count ${usage.trades} reached limit ${s.max_daily_trades}.`, rule: "max_daily_trades" };
  }
  if (usage.volume + input.volume > s.max_daily_volume + 1e-9) {
    return { reason: `Daily volume would exceed ${s.max_daily_volume}.`, rule: "max_daily_volume" };
  }
  if (usage.loss >= s.max_daily_loss) {
    return { reason: `Daily loss ${usage.loss} reached limit ${s.max_daily_loss}.`, rule: "max_daily_loss" };
  }
  return null;
}

export interface CloseCheckInput {
  ticket: string;
  symbol: string;
  side: string;
  volume: number;
}

/** Validate a close request against risk settings and live positions. */
export function checkCloseRisk(
  input: CloseCheckInput,
  s: RiskSettings,
  livePositions: any[],
): { reason: string; rule: string } | null {
  if (s.kill_switch_enabled) return { reason: "Trading disabled by kill switch.", rule: "kill_switch" };
  if (!s.live_trading_enabled) return { reason: "Live trading is disabled.", rule: "live_trading_disabled" };
  if (input.volume > s.max_close_volume + 1e-9) {
    return { reason: `Close volume ${input.volume} exceeds max ${s.max_close_volume}.`, rule: "max_close_volume" };
  }
  if (s.testing_mode_enabled && input.volume > TESTING_MAX_VOLUME + 1e-9) {
    return { reason: `Testing mode caps close volume at ${TESTING_MAX_VOLUME}.`, rule: "testing_mode_cap" };
  }
  const wantTicket = String(input.ticket);
  const match = livePositions.find((p) => String(p?.ticket ?? "") === wantTicket);
  if (!match) {
    return { reason: `Ticket ${wantTicket} not found in live MT5 positions.`, rule: "ticket_not_live" };
  }
  const pSym = String(match.symbol ?? "").toUpperCase();
  const pSide = String(match.side ?? "").toLowerCase();
  const pVol = Number(match.volume ?? 0);
  if (pSym !== input.symbol.toUpperCase()) {
    return { reason: `Symbol mismatch: live=${pSym} request=${input.symbol}`, rule: "symbol_mismatch" };
  }
  // close side is opposite of open side; allow either by checking open side in livePositions
  const expectedCloseSide = pSide === "buy" ? "sell" : "buy";
  if (input.side && input.side !== expectedCloseSide) {
    return { reason: `Side mismatch for close (expected ${expectedCloseSide}).`, rule: "side_mismatch" };
  }
  if (input.volume > pVol + 1e-9) {
    return { reason: `Close volume ${input.volume} exceeds open volume ${pVol}.`, rule: "volume_exceeds_open" };
  }
  return null;
}

/** Fetch live MT5 positions via get-live-account; returns [] on any failure. */
export async function fetchLivePositions(supabase: any): Promise<any[]> {
  try {
    const { data } = await supabase.functions.invoke("get-live-account", { body: {} });
    return Array.isArray(data?.positions) ? data.positions : [];
  } catch {
    return [];
  }
}
