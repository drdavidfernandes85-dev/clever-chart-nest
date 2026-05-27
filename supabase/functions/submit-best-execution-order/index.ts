// Best-Execution Order Router
// Wraps execute-trade with pre-trade quote snapshot + latency/slippage metrics.
//
// SPEED CONTRACT (v3):
//   - This function returns to the client as soon as Trading Layer responds.
//   - Reconciliation is owned by the shared client coordinator, which calls
//     reconcile-execution on a rate-limit-safe cadence carrying the IDs surfaced here.
//   - Confirmation-critical identifiers for accepted / unconfirmed orders are
//     written synchronously before returning to the client.
//   - Risk-block / freshness / dry-run audits remain synchronous because the
//     client uses them to decide whether to even continue.
//
// Dev-mode timings (returned only when payload.devMode === true) cover:
//   requestReceivedAt, authValidatedAt, accountResolvedAt, riskValidatedAt,
//   freshTickFetchedAt, orderSentToTradingLayerAt, tradingLayerResponseAt,
//   firstReconcileStartedAt (always null here — client owns reconcile),
//   mt5ConfirmedAt (null), finalUiStatusAt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  loadRiskSettings,
  loadDailyUsage,
  checkOpenRisk,
  buildRiskBlock,
  auditRiskBlock,
} from "../_shared/risk.ts";
import {
  resolveActiveMtMapping,
  STALE_MAPPING_ERROR_CODE,
  STALE_MAPPING_USER_MESSAGE,
} from "../_shared/mtMapping.ts";
import {
  assertLiveExecutionAllowed,
  LIVE_EXEC_DISABLED_CODE,
} from "../_shared/executionMode.ts";
import { EXECUTION_POLICY_VERSION, sideToOperation } from "../_shared/tradingLayerTradeMode.ts";
import {
  resolveFreshExecutionTick,
  FRESH_TICK_OK,
  FRESH_TICK_POLICY_VERSION,
  type FreshTickResult,
} from "../_shared/freshTick.ts";
import {
  resolveVerifiedExecutionInstrument,
  VERIFIED_EXECUTION_INSTRUMENT_VERSION,
} from "../_shared/executionInstrument.ts";

const VERSION = "BEST_EXEC_FAST_V3_2026_05_21";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Fire-and-forget on Deno deploy — survives the response if supported.
const fireAndForget = (p: Promise<unknown>) => {
  try {
    // @ts-ignore -- Deno Deploy / Supabase Edge Runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p.catch(() => {}));
    } else {
      p.catch(() => {});
    }
  } catch { /* ignore */ }
};

// Extract a value from any of the documented Trading Layer shapes.
const pick = (obj: any, paths: string[]): any => {
  if (!obj || typeof obj !== "object") return null;
  for (const path of paths) {
    const v = path
      .split(".")
      .reduce<any>((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
    if (v !== undefined && v !== null) return v;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const timings: Record<string, number | null> = {
    requestReceivedAt: Date.now(),
    authValidatedAt: null,
    accountResolvedAt: null,
    riskValidatedAt: null,
    freshTickFetchedAt: null,
    orderSentToTradingLayerAt: null,
    tradingLayerResponseAt: null,
    firstReconcileStartedAt: null, // owned by client
    mt5ConfirmedAt: null,           // owned by client
    finalUiStatusAt: null,
  };

  const authHeader = req.headers.get("Authorization") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const {
    tradeId,
    symbol,
    side,
    orderType = "market",
    volume,
    stopLoss = null,
    takeProfit = null,
    clientClickAt,
    dryRun = false,
    liveExecutionConfirmed = false,
    executionIntent = null,
    acknowledgedLiveTest = false,
    devModeAllowMissingQuote = false,
    devMode = false,
  } = payload || {};

  const withTimings = (body: Record<string, unknown>, status = 200) => {
    timings.finalUiStatusAt = Date.now();
    const enriched = devMode
      ? { ...body, timings, executionPolicyVersion: EXECUTION_POLICY_VERSION }
      : body;
    return json(enriched, status);
  };

  if (!symbol || !side || !volume) {
    return withTimings({
      success: false,
      error: "Missing required fields",
      reasons: ["symbol, side and volume are required"],
    }, 400);
  }
  if (orderType && String(orderType).toLowerCase() !== "market") {
    return withTimings({
      success: false,
      error: "Only market orders are supported by this router",
      reasons: [`orderType=${orderType} not supported`],
    }, 400);
  }

  const supabase = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // Cache the auth lookup once.
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id ?? null;
  timings.authValidatedAt = Date.now();

  // ---------------------------------------------------------------------------
  // Shared verified execution-instrument resolution.
  //
  // Single source of truth for: route, exact broker symbol, account+symbol
  // trade-mode, per-side eligibility. Used by both the Order Ticket
  // (get-terminal-execution-eligibility) and this submission path so they
  // can never disagree. We always run it for live orders; dry-run requests
  // tolerate failures here and continue to the dry-run short-circuit below.
  // ---------------------------------------------------------------------------
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY);
  const intendedOperation = sideToOperation(String(side ?? ""), String(orderType ?? "market"));
  const clientExpectedBrokerSymbol = (payload as any)?.brokerSymbol
    ? String((payload as any).brokerSymbol).trim()
    : null;
  let verifiedInstrument: any = null;
  if (uid) {
    try {
      verifiedInstrument = await resolveVerifiedExecutionInstrument(supabaseService, {
        userId: uid,
        displaySymbol: String(symbol),
        operation: intendedOperation,
        expectedBrokerSymbol: clientExpectedBrokerSymbol,
      });
    } catch (e) {
      verifiedInstrument = {
        success: false,
        errorCode: "INSTRUMENT_RESOLVER_FAILED",
        message: (e as Error)?.message ?? "Verified execution-instrument resolver failed.",
        resolutionStatus: "unresolved",
      };
    }
  }

  // Hard pre-trade gate for live orders: if the shared resolver did not
  // produce a verified executable instrument, do not even reach the fresh
  // tick / mutation path. Dry-run requests are allowed through to the
  // dry-run short-circuit (handled below).
  const isLiveOrder = dryRun !== true && liveExecutionConfirmed === true;
  if (isLiveOrder && verifiedInstrument && (!verifiedInstrument.success || !verifiedInstrument.brokerSymbol || verifiedInstrument.operationEligible === false)) {
    const code = verifiedInstrument.errorCode || verifiedInstrument.operationBlockedReason || "BROKER_SYMBOL_RESOLUTION_FAILED_PRETRADE";
    const message = verifiedInstrument.message
      || verifiedInstrument.operationBlockedReason
      || "Live order blocked: the exact executable broker symbol could not be validated at submission time. No order was sent.";
    if (uid) {
      fireAndForget(supabase.from("execution_audit_events").insert({
        user_id: uid,
        trade_id: tradeId ?? null,
        symbol,
        side,
        volume: Number(volume),
        status: "blocked",
        outcome: "blocked",
        requested_price: null,
        executed_price: null,
        slippage: null,
        latency_ms: 0,
        spread: null,
        bid: null,
        ask: null,
        broker_message: message,
        retcode: null,
        reason: "blocked_broker_symbol_resolution_pretrade",
        rule_violated: "verified_execution_instrument_required",
        ticket: null,
        raw: {
          classification: "blocked_broker_symbol_resolution_pretrade",
          version: VERSION,
          step: "pretrade_symbol_resolution",
          liveOrderAttempted: false,
          liveOrderSent: false,
          brokerAccepted: false,
          resolverVersion: VERIFIED_EXECUTION_INSTRUMENT_VERSION,
          executionPolicyVersion: EXECUTION_POLICY_VERSION,
          verifiedInstrument: verifiedInstrument ?? null,
        },
      }));
    }
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_symbol_resolution",
      classification: "blocked_broker_symbol_resolution_pretrade",
      blocked: true,
      liveOrderAttempted: false,
      liveOrderSent: false,
      brokerAccepted: false,
      tradeId,
      displaySymbol: verifiedInstrument?.displaySymbol ?? symbol,
      brokerSymbol: verifiedInstrument?.brokerSymbol ?? null,
      resolutionStatus: verifiedInstrument?.resolutionStatus ?? null,
      routeAccountIdMasked: verifiedInstrument?.routeAccountIdMasked ?? null,
      accountTradeModeRaw: verifiedInstrument?.accountTradeModeRaw ?? null,
      accountTradeModeLabel: verifiedInstrument?.accountTradeModeLabel ?? null,
      symbolTradeModeRaw: verifiedInstrument?.symbolTradeModeRaw ?? null,
      symbolTradeModeLabel: verifiedInstrument?.symbolTradeModeLabel ?? null,
      operationIntent: intendedOperation,
      operationEligible: verifiedInstrument?.operationEligible ?? false,
      operationBlockedReason: verifiedInstrument?.operationBlockedReason ?? null,
      executionPolicyVersion: EXECUTION_POLICY_VERSION,
      resolverVersion: VERIFIED_EXECUTION_INSTRUMENT_VERSION,
      error: code,
      message,
      reasons: [message],
    });
  }

  // ---------------------------------------------------------------------------
  // Pre-trade authoritative server-side fresh-tick validation.
  //
  // ROUTE: verified Trading Layer account route (from shared resolver when
  // available; otherwise best-effort lookup).
  // SYMBOL: exact broker symbol resolved server-side (NEVER from display
  // ticks / WebSocket / /get-mt5-quotes).
  // ---------------------------------------------------------------------------
  let requestedBid: number | null = null;
  let requestedAsk: number | null = null;
  let quoteTimestamp: string | null = null;
  let quoteSource: string = "trading_layer_latest_tick";
  let freshTick: FreshTickResult | null = null;
  let routeAccountIdForTick: string | null = verifiedInstrument?.routeAccountId ?? null;
  const tickBrokerSymbol =
    verifiedInstrument?.brokerSymbol
    || String((payload as any)?.brokerSymbol || symbol || "").trim().toUpperCase();
  if (!routeAccountIdForTick && uid) {
    try {
      const { data: acct } = await supabase
        .from("user_mt_accounts")
        .select("trading_layer_account_id")
        .eq("user_id", uid)
        .eq("platform", "mt5")
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      routeAccountIdForTick = (acct as any)?.trading_layer_account_id ?? null;
    } catch { /* ignore — handled by missing-route code below */ }
  }
  freshTick = await resolveFreshExecutionTick({
    routeAccountId: routeAccountIdForTick,
    brokerSymbol: tickBrokerSymbol || null,
    displaySymbol: symbol,
  });
  requestedBid = freshTick.bid;
  requestedAsk = freshTick.ask;
  quoteTimestamp = freshTick.timestamp;
  quoteSource = freshTick.source;
  timings.freshTickFetchedAt = Date.now();

  const requestedPrice =
    side === "buy" ? requestedAsk : side === "sell" ? requestedBid : null;
  const haveFreshQuote =
    freshTick.fresh && requestedBid != null && requestedAsk != null && requestedPrice != null;





  const startedAt = Date.now();
  const clientLatencyMs = clientClickAt
    ? Math.max(0, startedAt - Date.parse(clientClickAt))
    : null;

  // ---------------------------------------------------------------------------
  // DRY RUN — short-circuit before any Trading Layer call.
  // ---------------------------------------------------------------------------
  if (dryRun === true) {
    const spreadDry =
      requestedBid != null && requestedAsk != null
        ? Math.max(0, requestedAsk - requestedBid)
        : null;
    if (uid) {
      fireAndForget(supabase.from("execution_audit_events").insert({
        user_id: uid,
        trade_id: tradeId ?? null,
        symbol,
        side,
        volume: Number(volume),
        status: "dry_run",
        outcome: "success",
        requested_price: requestedPrice,
        executed_price: null,
        slippage: null,
        latency_ms: Math.round(Date.now() - startedAt),
        spread: spreadDry,
        bid: requestedBid,
        ask: requestedAsk,
        broker_message: "Pre-trade check OK (dry run)",
        retcode: null,
        reason: null,
        rule_violated: null,
        ticket: null,
        raw: {
          classification: "pretrade_check",
          version: VERSION,
          step: "dry_run",
          liveOrderSent: false,
          liveOrderAttempted: false,
          effectiveDryRun: true,
        },
      }));
    }
    return withTimings({
      success: true,
      version: VERSION,
      step: "dry_run",
      classification: "pretrade_check",
      liveOrderSent: false,
      liveOrderAttempted: false,
      effectiveDryRun: true,
    });
  }


  if (liveExecutionConfirmed !== true) {
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_validation",
      liveOrderSent: false,
      error: "Live execution requires liveExecutionConfirmed=true.",
      reasons: ["Missing live execution confirmation"],
    });
  }

  // Admin live-test intent gate. When the client sends
  // executionIntent="admin_live_test_live_order" the user MUST also flag
  // acknowledgedLiveTest=true. The mode/admin/mapping checks below
  // (assertLiveExecutionAllowed) enforce who may execute; we never silently
  // downgrade the request to a dry run.
  if (executionIntent === "admin_live_test_live_order" && acknowledgedLiveTest !== true) {
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_validation",
      liveOrderSent: false,
      error: "Admin live test requires session acknowledgement.",
      reasons: ["Missing admin live-test acknowledgement"],
    });
  }


  // ---------- Backend risk enforcement (always synchronous) ----------
  try {
    if (uid) {
      const settings = await loadRiskSettings(supabase, uid);
      const usage = await loadDailyUsage(supabase, uid);
      const breach = checkOpenRisk(
        { symbol, volume: Number(volume) },
        settings,
        usage,
      );
      if (breach) {
        const blockBody = buildRiskBlock(VERSION, {
          reason: breach.reason,
          rule: breach.rule,
          settings,
          usage,
        }, { tradeId, symbol, side, volume: Number(volume) });
        // Synchronous audit so client can rely on it for risk_blocked toasts.
        await auditRiskBlock(supabase, uid, {
          tradeId, symbol, side, volume: Number(volume),
          reason: breach.reason, rule: breach.rule, response: blockBody,
        });
        timings.riskValidatedAt = Date.now();
        return withTimings(blockBody);
      }
    }
  } catch { /* if risk lookup fails entirely, fall through (audit only) */ }
  timings.riskValidatedAt = Date.now();

  // Freshness gate — refuse live execution without a fresh server-side tick.
  // devModeAllowMissingQuote is honored ONLY for dry-runs (handled earlier);
  // for real orders we never bypass this gate.
  if (!haveFreshQuote) {
    const ftCode = freshTick?.code ?? "FRESH_TICK_UNAVAILABLE";
    const ftMessage =
      freshTick?.message ?? "Live order blocked: no fresh server-side quote is available for execution validation.";
    if (uid) {
      fireAndForget(supabase.from("execution_audit_events").insert({
        user_id: uid,
        trade_id: tradeId ?? null,
        symbol,
        side,
        volume: Number(volume),
        status: "blocked",
        outcome: "blocked",
        requested_price: requestedPrice,
        executed_price: null,
        slippage: null,
        latency_ms: Math.round(Date.now() - startedAt),
        spread:
          requestedBid != null && requestedAsk != null
            ? Math.max(0, requestedAsk - requestedBid)
            : null,
        bid: requestedBid,
        ask: requestedAsk,
        broker_message: ftMessage,
        retcode: null,
        reason: ftCode.toLowerCase(),
        rule_violated: "fresh_tick_required",
        ticket: null,
        raw: {
          classification: "blocked_missing_fresh_server_tick",
          version: VERSION,
          step: "pretrade_fresh_tick_validation",
          liveOrderAttempted: false,
          liveOrderSent: false,
          brokerAccepted: false,
          quote_bid: requestedBid,
          quote_ask: requestedAsk,
          quote_timestamp: quoteTimestamp,
          quote_source: quoteSource,
          quote_age_ms: freshTick?.ageMs ?? null,
          quote_threshold_ms: freshTick?.thresholdMs ?? null,
          route_account_id_masked: freshTick?.routeAccountIdMasked ?? null,
          broker_symbol: freshTick?.brokerSymbol ?? null,
          upstream_status: freshTick?.upstreamStatus ?? null,
          fresh_tick_policy_version: FRESH_TICK_POLICY_VERSION,
          fresh_tick_code: ftCode,
        },
      }));
    }
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_fresh_tick_validation",
      classification: "blocked_missing_fresh_server_tick",
      liveOrderAttempted: false,
      liveOrderSent: false,
      brokerAccepted: false,
      tradeId,
      error: ftCode,
      message: ftMessage,
      reasons: [ftMessage],
      requestedPrice,
      bid: requestedBid,
      ask: requestedAsk,
      quoteTimestamp,
      quoteAgeMs: freshTick?.ageMs ?? null,
      quoteThresholdMs: freshTick?.thresholdMs ?? null,
      brokerSymbol: freshTick?.brokerSymbol ?? null,
      routeAccountIdMasked: freshTick?.routeAccountIdMasked ?? null,
      freshTickPolicyVersion: FRESH_TICK_POLICY_VERSION,
    });
  }


  // Resolve mapping once — used for diagnostics AND to hard-block stale
  // mappings before any order is forwarded to execute-trade.
  let mapping: {
    localRowId: string | null;
    traderId: string | null;
    login: string | null;
    server: string | null;
    status: "valid" | "stale" | "missing" | "unknown";
  } = { localRowId: null, traderId: null, login: null, server: null, status: "unknown" };
  if (uid) {
    try {
      const m = await resolveActiveMtMapping(supabase, uid);
      mapping = {
        localRowId: m.localRowId,
        traderId: m.traderId,
        login: m.login,
        server: m.server,
        status: m.status,
      };
      if (m.status === "stale" || (m.status !== "missing" && !m.traderId)) {
        timings.accountResolvedAt = Date.now();
        timings.finalUiStatusAt = Date.now();
        return withTimings({
          success: false,
          version: VERSION,
          step: "mapping_validation",
          liveOrderSent: false,
          tradeId,
          error: STALE_MAPPING_ERROR_CODE,
          message: STALE_MAPPING_USER_MESSAGE,
          mapping,
        });
      }
    } catch { /* diagnostics-only */ }
  }
  timings.accountResolvedAt = Date.now();

  // ---------- Execution-mode allowlist (admin live testing gate) ----------
  const gate = await assertLiveExecutionAllowed(supabase, uid, {
    traderId: mapping.traderId,
    login: mapping.login,
  });
  if (!gate.allowed) {
    return withTimings({
      success: false,
      version: VERSION,
      step: "execution_mode_gate",
      liveOrderSent: false,
      tradeId,
      error: gate.code || LIVE_EXEC_DISABLED_CODE,
      reason: gate.reason,
      executionMode: gate.mode,
    }, 403);
  }

  // Final activation blocker — only submit-controlled-retest may dispatch.
  try {
    const { data: blk } = await supabase.from("site_settings").select("value").eq("key","final_activation_blocker").maybeSingle();
    const v: any = blk?.value;
    if (v?.active === true) {
      return withTimings({
        success: false, version: VERSION, step: "final_activation_blocker", tradeId,
        error: "FINAL_ACTIVATION_BLOCKER_ACTIVE",
        blockReasonCode: v.block_reason_code ?? null,
        displayCopy: v.display_copy ?? null,
        liveOrderSent: false,
      }, 423);
    }
  } catch { /* best effort */ }


  // ---------- Trading Layer execution eligibility (broker-symbol gate) ----------
  // Now sourced from the SAME shared resolver as get-terminal-execution-eligibility
  // (resolveVerifiedExecutionInstrument). The legacy get-trading-execution-eligibility
  // call has been removed because it interpreted numeric account.trade_mode as
  // "awaiting enum confirmation" and produced false BROKER_SYMBOL_UNRESOLVED blocks.
  let brokerSymbol: string | null = verifiedInstrument?.brokerSymbol ?? null;
  let symbolTradeMode: string | null = verifiedInstrument?.symbolTradeModeLabel
    ?? (verifiedInstrument?.symbolTradeModeRaw != null ? String(verifiedInstrument.symbolTradeModeRaw) : null);
  let accountTradeMode: string | null = verifiedInstrument?.accountTradeModeLabel
    ?? (verifiedInstrument?.accountTradeModeRaw != null ? String(verifiedInstrument.accountTradeModeRaw) : null);
  let mappingCheckedAt: string | null = verifiedInstrument?.checkedAt ?? null;
  let mappingSource: string | null = verifiedInstrument ? "verified_execution_instrument_v1" : null;




  // ---------- Admin live-test session precheck ----------
  // For admin live verification orders only, refuse to forward to the broker
  // when the symbol's session is not eligible. This mirrors the frontend
  // gate and prevents broker rejections (e.g. retcode 10017 outside session)
  // from polluting the live-test matrix.
  //
  // Source priority:
  //   1. explicit Trading Layer / broker trade-mode (not yet exposed — TODO)
  //   2. explicit MT5 trade-session data (not yet exposed — TODO)
  //   3. recent executable tick inference (quoteTimestamp + bid/ask)
  //   4. forex weekend rule
  //   5. unknown — do not block
  if (executionIntent === "admin_live_test_live_order") {
    const symU = String(symbol).toUpperCase();
    const isCrypto = /(BTC|ETH|USDT|SOL|XRP|ADA|DOGE|BNB|MATIC|DOT)/.test(symU);
    const isForexLike = !isCrypto && /^(?:[A-Z]{6}|XAU|XAG|GOLD|SILV|WTI|USOIL|UKOIL|BRENT|NGAS)/.test(symU);
    const nowMs = Date.now();
    const tickMs = quoteTimestamp ? Date.parse(quoteTimestamp) : NaN;
    const tickAgeMs = Number.isFinite(tickMs) ? Math.max(0, nowMs - tickMs) : null;
    const hasExecutableTick =
      requestedBid != null && requestedAsk != null &&
      tickAgeMs != null && tickAgeMs <= 60_000;

    const nowDate = new Date(nowMs);
    const day = nowDate.getUTCDay();
    const hour = nowDate.getUTCHours();
    const isForexWeekend =
      day === 6 || (day === 5 && hour >= 22) || (day === 0 && hour < 22);

    let sessionEligibility: "eligible" | "blocked" | "unknown" = "unknown";
    let sessionSource: "broker_status" | "recent_tick_inference" | "weekend_rule" | "unknown" = "unknown";
    let precheckClassification: string | null = null;
    let precheckMessage = "";

    if (isCrypto) {
      sessionEligibility = "eligible";
      sessionSource = "recent_tick_inference";
    } else if (isForexLike && isForexWeekend) {
      sessionEligibility = "blocked";
      sessionSource = "weekend_rule";
      precheckClassification = "market_closed_precheck";
      precheckMessage = "Market closed. No test order was submitted. Try again during an active trading session.";
    } else if (hasExecutableTick) {
      sessionEligibility = "eligible";
      sessionSource = "recent_tick_inference";
    } else if (isForexLike) {
      // Forex weekday but no fresh executable tick — treat as not eligible.
      sessionEligibility = "blocked";
      sessionSource = "recent_tick_inference";
      precheckClassification = "no_executable_tick_precheck";
      precheckMessage = "No executable tick available — trading is currently unavailable for this symbol.";
    }

    if (precheckClassification) {
      // Informational audit row only — excluded from pass/fail matrix.
      if (uid) {
        fireAndForget(supabase.from("execution_audit_events").insert({
          user_id: uid,
          trade_id: tradeId ?? null,
          symbol,
          side,
          volume: Number(volume),
          status: "blocked",
          outcome: "blocked",
          requested_price: requestedPrice,
          executed_price: null,
          slippage: null,
          latency_ms: Math.round(Date.now() - startedAt),
          spread:
            requestedBid != null && requestedAsk != null
              ? Math.max(0, requestedAsk - requestedBid)
              : null,
          bid: requestedBid,
          ask: requestedAsk,
          broker_message: precheckMessage,
          retcode: null,
          reason: precheckClassification,
          rule_violated: null,
          ticket: null,
          raw: {
            classification: precheckClassification,
            version: VERSION,
            step: "session_precheck",
            liveOrderAttempted: false,
            liveOrderSent: false,
            brokerAccepted: false,
            sessionEligibility,
            sessionSource,
            tickAgeMs,
            quote_timestamp: quoteTimestamp,
            quote_source: quoteSource,
            informational: true,
          },
        }));
      }
      timings.finalUiStatusAt = Date.now();
      return withTimings({
        success: false,
        version: VERSION,
        step: "session_precheck",
        classification: precheckClassification,
        liveOrderAttempted: false,
        liveOrderSent: false,
        brokerAccepted: false,
        sessionEligibility,
        sessionSource,
        tickAgeMs,
        tradeId,
        error: precheckMessage,
        message: precheckMessage,
      });
    }
  }


  timings.orderSentToTradingLayerAt = Date.now();
  const { data: execData, error: execError } = await supabase.functions.invoke(
    "execute-trade",
    {
      body: {
        tradeId,
        // Real execution must use the exact broker symbol returned by
        // Trading Layer (e.g. XAUUSD+); only fall back to canonical/display
        // symbol for non-admin-live-test paths where no eligibility check
        // ran.
        symbol: brokerSymbol || symbol,
        displaySymbol: symbol,
        brokerSymbol,
        symbolTradeMode,
        accountTradeMode,
        symbolMappingSource: mappingSource,
        symbolMappingCheckedAt: mappingCheckedAt,
        side,
        volume: Number(volume),
        stopLoss: stopLoss == null ? null : Number(stopLoss),
        takeProfit: takeProfit == null ? null : Number(takeProfit),
        executionIntent,
        acknowledgedLiveTest,
        requestedDryRun: false,
        effectiveDryRun: false,
        liveOrderAttempted: true,
        executionMode: gate.mode ?? null,
      },
    },
  );

  timings.tradingLayerResponseAt = Date.now();

  const serverLatencyMs = Date.now() - startedAt;
  const totalLatencyMs =
    clientLatencyMs != null ? clientLatencyMs + serverLatencyMs : serverLatencyMs;

  // Try to recover JSON body from supabase-js FunctionsHttpError context.
  let res: any = execData;
  if (execError && !res) {
    try {
      const ctx: any = (execError as any)?.context;
      if (ctx?.json) res = await ctx.json();
      else if (ctx?.text) res = JSON.parse(await ctx.text());
    } catch { /* ignore */ }
  }

  if (!res) {
    return withTimings({
      success: false,
      version: VERSION,
      step: "pretrade_validation",
      liveOrderSent: false,
      tradeId,
      error: (execError as any)?.message || "execute-trade returned no body",
      latencyMs: totalLatencyMs,
      requestedPrice,
    });
  }

  // Extract every ID Trading Layer might return so the client can use them
  // as primary reconciliation keys (positionTicket → dealId → orderId →
  // requestId/clientOrderId → fallback symbol+side+vol match).
  const result = res?.data ?? res;
  const positionTicket = pick(result, [
    "position.ticket", "position.id", "positionTicket",
    "ticket", "data.ticket",
  ]);
  const orderTicket = pick(result, [
    "order.ticket", "order.id", "orderId", "order_id",
    "data.order.ticket", "ticketOrder",
  ]);
  const dealId = pick(result, [
    "deal.ticket", "deal.id", "dealId", "deal_id",
    "data.deal.ticket", "data.deal.id",
  ]);
  const requestId = pick(result, [
    "requestId", "request_id", "data.requestId", "data.request_id",
    "broker.requestId", "raw.requestId",
  ]);
  const clientOrderId = pick(result, [
    "clientOrderId", "client_order_id", "data.clientOrderId", "data.client_order_id",
  ]) ?? tradeId ?? null;
  const responseSymbol = pick(result, ["symbol", "data.symbol", "order.symbol", "position.symbol"]);
  const responseVolume = pick(result, ["volume", "data.volume", "order.volume", "deal.volume"]);
  const responsePrice = pick(result, ["price", "data.price", "deal.price", "order.price", "openPrice", "open_price"]);
  const responseSide = pick(result, ["side", "data.side", "order.side"]);

  const executedPrice =
    res.price ?? res.openPrice ?? res.executedPrice ?? responsePrice ?? null;
  const slippage =
    requestedPrice != null && executedPrice != null
      ? Number(executedPrice) - Number(requestedPrice)
      : null;
  const brokerMessageRaw =
    res.brokerMessage ??
    res.retcodeDescription ??
    res.retcode_description ??
    res.message ??
    res.error ??
    null;

  const retcodeNum = res.retcode != null && Number.isFinite(Number(res.retcode))
    ? Number(res.retcode)
    : null;
  const retcodeName = pick(res, ["retcodeName", "retcode_name", "data.retcodeName", "data.retcode_name"]);
  const retcodeDescription = pick(res, [
    "retcodeDescription", "retcode_description", "comment", "message",
    "data.retcodeDescription", "data.retcode_description",
  ]) ?? brokerMessageRaw;

  // Retcode taxonomy for market orders
  //   10009 = TRADE_RETCODE_DONE       → filled
  //   10008 = TRADE_RETCODE_PLACED     → accepted, NOT confirmed
  const retcodeFilled = retcodeNum === 10009;
  const retcodeAccepted = retcodeNum === 10008;

  const upstreamSuccess = res.success === true;
  const upstreamStatus = String(res.status ?? res.classification ?? "").toLowerCase();
  const isBlocked =
    upstreamStatus === "blocked" ||
    res.blocked === true ||
    (Array.isArray(res.reasons) && res.reasons.length > 0 && retcodeNum == null);
  const isPlacedOnly =
    retcodeAccepted ||
    (upstreamSuccess && !retcodeFilled && executedPrice == null) ||
    upstreamStatus === "placed";

  // ---------------------------------------------------------------------------
  // Final lifecycle determination — NO blocking reconciliation here.
  //  - If broker accepted → status: broker_accepted_pending_confirmation
  //  - Client owns the reconcile-execution loop using the IDs below.
  // ---------------------------------------------------------------------------
  const brokerAccepted = upstreamSuccess || retcodeFilled || retcodeAccepted || isPlacedOnly;
  const liveOrderSent = brokerAccepted;

  let success: boolean;
  let status: string;
  let outcome: string;
  let step: string;
  let classification: string;
  let brokerMessage = brokerMessageRaw;

  if (isBlocked) {
    success = false;
    status = "blocked";
    outcome = "blocked";
    step = "pretrade_validation";
    classification = "blocked";
  } else if (brokerAccepted) {
    // Client must run reconcile-execution to flip to position_confirmed.
    success = true; // broker accepted, optimistic non-final state for the UI
    status = "broker_accepted_pending_confirmation";
    outcome = "broker_accepted";
    step = "execution_result";
    classification = "broker_accepted_pending_confirmation";
    brokerMessage = "Broker accepted — waiting for MT5 confirmation.";
  } else {
    // Broker REJECTED a real live request. This is NOT a dry run, and NOT a
    // pre-trade validation block. The request reached Trading Layer and the
    // broker refused it (e.g. retcode 10017 TRADE_RETCODE_TRADE_DISABLED).
    success = false;
    status = "rejected";
    outcome = "rejected";
    step = "execution_result";
    classification = retcodeNum === 10017 ? "order_rejected_trade_disabled" : "order_rejected";
  }


  const spread =
    requestedBid != null && requestedAsk != null
      ? Math.max(0, requestedAsk - requestedBid)
      : null;
  const reasonsText = Array.isArray(res.reasons) ? res.reasons.join(" · ") : null;

  // Sanitized diagnostics (no secrets) — surfaced in Dev Mode by the UI.
  const submittedAt = timings.orderSentToTradingLayerAt
    ? new Date(timings.orderSentToTradingLayerAt).toISOString()
    : null;
  const responseReceivedAt = timings.tradingLayerResponseAt
    ? new Date(timings.tradingLayerResponseAt).toISOString()
    : null;
  const responseIdentifiers = {
    tradeId: tradeId ?? null,
    clientOrderId,
    requestId: requestId != null ? String(requestId) : null,
    retcode: retcodeNum,
    retcodeName: retcodeName != null ? String(retcodeName) : null,
    retcodeDescription: retcodeDescription != null ? String(retcodeDescription) : null,
    orderId: orderTicket != null ? String(orderTicket) : null,
    order: orderTicket != null ? String(orderTicket) : null,
    dealId: dealId != null ? String(dealId) : null,
    deal: dealId != null ? String(dealId) : null,
    positionTicket: positionTicket != null ? String(positionTicket) : null,
    ticket: positionTicket != null ? String(positionTicket) : null,
    positionId: positionTicket != null ? String(positionTicket) : null,
    brokerSymbol: responseSymbol ?? symbol,
    side: responseSide ?? side,
    volume: responseVolume != null ? Number(responseVolume) : Number(volume),
    requestedPrice,
    tradingLayerTraderId: mapping.traderId,
    tradingLayerAccountId: mapping.traderId,
    brokerAccepted,
    submittedAt,
    responseReceivedAt,
  };
  const idsPresent = Boolean(
    responseIdentifiers.requestId ||
    responseIdentifiers.orderId ||
    responseIdentifiers.dealId ||
    responseIdentifiers.positionTicket
  );

  const diagnostics = {
    payloadSent: {
      tradeId, symbol, side, orderType, volume: Number(volume),
      stopLoss, takeProfit,
    },
    rawTradingLayerResponse: res,
    transport: "rest",
    accountIdUsed: mapping.traderId,
    localRowId: mapping.localRowId,
    tradingLayerTraderId: mapping.traderId,
    mt5Login: mapping.login,
    mt5Server: mapping.server,
    brokerSymbol: responseSymbol ?? symbol,
    displaySymbol: symbol,
    side: responseSide ?? side,
    volume: responseVolume != null ? Number(responseVolume) : Number(volume),
    retcode: retcodeNum,
    retcodeName: responseIdentifiers.retcodeName,
    retcodeDescription: responseIdentifiers.retcodeDescription,
    orderId: responseIdentifiers.orderId,
    dealId: responseIdentifiers.dealId,
    positionTicket: responseIdentifiers.positionTicket,
    requestId: responseIdentifiers.requestId,
    clientOrderId: responseIdentifiers.clientOrderId,
    idsPresent,
    responseIdentifiers,
    brokerResponseTimeMs: timings.tradingLayerResponseAt && timings.orderSentToTradingLayerAt
      ? (timings.tradingLayerResponseAt - timings.orderSentToTradingLayerAt)
      : null,
  };

  // Audit insert — confirmation-critical IDs for accepted/unconfirmed paths are
  // synchronous. Only non-critical enrichment may be deferred elsewhere.
  if (uid) {
    const auditRow = {
      user_id: uid,
      trade_id: tradeId ?? null,
      symbol,
      side,
      volume: Number(volume),
      status,
      outcome,
      requested_price: requestedPrice,
      executed_price: executedPrice != null ? Number(executedPrice) : null,
      slippage,
      latency_ms: Math.round(totalLatencyMs),
      spread,
      bid: requestedBid,
      ask: requestedAsk,
      broker_message: brokerMessage,
      retcode: retcodeNum,
      reason: outcome === "blocked" || outcome === "rejected"
        ? (res.error || reasonsText || brokerMessage || null)
        : null,
      rule_violated: outcome === "blocked" ? (res.ruleViolated || reasonsText || res.error || null) : null,
      ticket: positionTicket != null ? String(positionTicket) : null,
      raw: {
        ...(res && typeof res === "object" ? res : {}),
        classification,
        version: VERSION,
        step,
        liveOrderSent,
        brokerAccepted,
        submittedAt,
        responseReceivedAt,
        responseIdentifiers,
        idsPresent,
        idsMessage: idsPresent
          ? null
          : "Trading Layer response did not return confirmation identifiers.",
        positionTicket: diagnostics.positionTicket,
        orderId: diagnostics.orderId,
        dealId: diagnostics.dealId,
        requestId: diagnostics.requestId,
        quote_bid: requestedBid,
        quote_ask: requestedAsk,
        quote_spread: spread,
        quote_timestamp: quoteTimestamp,
        quote_source: quoteSource,
        diagnostics,
      },
    };
    if (outcome === "rejected" || brokerAccepted) {
      try { await supabase.from("execution_audit_events").insert(auditRow); } catch { /* swallow */ }
    } else {
      fireAndForget(supabase.from("execution_audit_events").insert(auditRow));
    }
  }

  return withTimings({
    success,
    version: VERSION,
    step,
    liveOrderSent,
    liveOrderAttempted: true,
    effectiveDryRun: false,
    requestedDryRun: false,
    executionIntent,
    acknowledgedLiveTest,
    brokerAccepted,
    mt5Confirmed: false, // never true here — client owns confirmation
    confirmationStatus: brokerAccepted
      ? "broker_accepted_pending_confirmation"
      : (isBlocked ? "blocked" : (retcodeNum === 10017 ? "order_rejected_trade_disabled" : "order_rejected")),

    tradeId,
    status,
    outcome,
    classification,
    requestedPrice,
    executedPrice: executedPrice != null ? Number(executedPrice) : null,
    slippage,
    latencyMs: totalLatencyMs,
    clientLatencyMs,
    serverLatencyMs,
    spread,
    bid: requestedBid,
    ask: requestedAsk,
    brokerMessage,
    // Surface every ID the client may use as a reconciliation key.
    ticket: diagnostics.positionTicket,
    positionTicket: diagnostics.positionTicket,
    orderId: diagnostics.orderId,
    dealId: diagnostics.dealId,
    requestId: diagnostics.requestId,
    clientOrderId: diagnostics.clientOrderId,
    responseIdentifiers,
    idsPresent,
    idsMessage: idsPresent ? null : "Trading Layer response did not return confirmation identifiers.",
    brokerSymbol: diagnostics.brokerSymbol,
    retcode: retcodeNum,
    retcodeName: diagnostics.retcodeName,
    retcodeDescription: diagnostics.retcodeDescription,
    error: success ? null : (res.error || brokerMessage || "Order rejected"),
    reasons: res.reasons ?? null,
    diagnostics,
  });
});
