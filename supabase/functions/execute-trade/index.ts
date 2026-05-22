import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveActiveMtMapping,
  STALE_MAPPING_ERROR_CODE,
  STALE_MAPPING_USER_MESSAGE,
} from "../_shared/mtMapping.ts";
import {
  assertLiveExecutionAllowed,
  LIVE_EXEC_DISABLED_CODE,
} from "../_shared/executionMode.ts";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeSide(value: string): "buy" | "sell" | null {
  const side = String(value || "")
    .trim()
    .toLowerCase();

  if (side === "buy") return "buy";
  if (side === "sell") return "sell";

  return null;
}

function normalizeSymbol(value: string): string {
  return String(value || "")
    .trim()
    .replace("/", "")
    .replace("-", "")
    .toUpperCase();
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function toNullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getValue(obj: unknown, paths: string[], fallback: unknown = null): unknown {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce<unknown>((acc, key) => (isRecord(acc) ? acc[key] : undefined), obj);
    if (value !== undefined && value !== null) return value;
  }

  return fallback;
}

function getBrokerMessage(payload: unknown): string {
  const message =
    getValue(payload, [
      "error.message",
      "error",
      "message",
      "detail",
      "title",
      "data.message",
      "data.error.message",
      "data.retcode_description",
      "data.retcodeDescription",
      "retcode_description",
      "retcodeDescription",
      "comment",
    ]);

  if (!message) {
    return "Trade execution failed.";
  }

  if (typeof message === "string") {
    return message;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return "Trade execution failed.";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!TRADING_LAYER_KEY) {
      return json(
        {
          success: false,
          step: "env",
          error: "Missing TRADING_LAYER_API_KEY",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json(
        {
          success: false,
          step: "auth",
          error: "Missing Authorization header.",
        },
        401,
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json(
        {
          success: false,
          step: "auth",
          error: "Unauthorized.",
        },
        401,
      );
    }

    const body = await req.json();

    const tradeId = String(body.tradeId || crypto.randomUUID());
    const symbol = normalizeSymbol(body.symbol);
    const side = normalizeSide(body.side);
    const volume = Number(body.volume);

    const stopLoss = toOptionalNumber(body.stopLoss);
    const takeProfit = toOptionalNumber(body.takeProfit);

    if (!symbol) {
      return json(
        {
          success: false,
          step: "validation",
          error: "Symbol is required.",
        },
        400,
      );
    }

    if (!side) {
      return json(
        {
          success: false,
          step: "validation",
          error: "Trade direction must be buy or sell.",
        },
        400,
      );
    }

    if (!Number.isFinite(volume) || volume <= 0) {
      return json(
        {
          success: false,
          step: "validation",
          error: "Volume must be greater than 0.",
        },
        400,
      );
    }

    const mapping = await resolveActiveMtMapping(supabase, user.id);
    if (mapping.status === "missing") {
      return json(
        {
          success: false,
          step: "account_lookup",
          error: "No connected MT5 account found.",
        },
        404,
      );
    }
    if (mapping.status === "stale" || !mapping.traderId) {
      return json(
        {
          success: false,
          step: "mapping_validation",
          error: STALE_MAPPING_ERROR_CODE,
          message: STALE_MAPPING_USER_MESSAGE,
          mappingStatus: mapping.status,
          localRowId: mapping.localRowId,
        },
        409,
      );
    }

    const accountId = mapping.traderId;
    const idempotencyKey = `trade-${tradeId}-${user.id}`;

    const orderPayload: Record<string, unknown> = {
      side,
      symbol,
      volume,
      deviation: 20,
    };

    /*
      Important:
      Only include Stop Loss / Take Profit when the user actually entered valid numbers.
      If the frontend sends null, empty, undefined, or invalid values, we do NOT send SL/TP to Trading Layer.
      This prevents broker rejection errors like "Invalid stops in the request".
    */
    if (typeof stopLoss === "number" && Number.isFinite(stopLoss)) {
      orderPayload.stopLoss = stopLoss;
    }

    if (typeof takeProfit === "number" && Number.isFinite(takeProfit)) {
      orderPayload.takeProfit = takeProfit;
    }

    const tradeResponse = await fetch(`${BASE_URL}/api/v1/accounts/${accountId}/trades/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRADING_LAYER_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(orderPayload),
    });

    const tradeText = await tradeResponse.text();

    let tradeData: unknown;
    try {
      tradeData = JSON.parse(tradeText);
    } catch {
      tradeData = { raw: tradeText };
    }

    const result = tradeData?.data || tradeData;

    const classification = String(
      getValue(result, ["classification", "result.classification", "trade.classification", "order.classification"], ""),
    ).toLowerCase();

    const retcode = toNullableNumber(
      getValue(result, ["retcode", "result.retcode", "trade.retcode", "order.retcode"], null),
    );

    const retcodeName = getValue(
      result,
      ["retcode_name", "retcodeName", "result.retcode_name", "trade.retcode_name", "order.retcode_name"],
      null,
    );

    const retcodeDescription = getValue(
      result,
      [
        "retcode_description",
        "retcodeDescription",
        "comment",
        "message",
        "result.retcode_description",
        "trade.retcode_description",
        "order.retcode_description",
      ],
      null,
    );

    const acceptedStates = ["done", "placed", "partial"];

    const isAccepted = tradeResponse.ok && acceptedStates.includes(classification);

    const finalStatus = isAccepted ? classification : tradeResponse.ok ? "rejected" : "failed";

    const brokerMessage = retcodeDescription || getBrokerMessage(tradeData);

    const { error: logError } = await supabase.from("trade_execution_logs").insert({
      user_id: user.id,
      signal_id: tradeId,
      symbol,
      side,
      volume,
      stop_loss: stopLoss ?? null,
      take_profit: takeProfit ?? null,
      classification: classification || null,
      retcode,
      retcode_description: brokerMessage,
      request_payload: orderPayload,
      response_payload: tradeData,
      http_status: tradeResponse.status,
      status: finalStatus,
      error_message: isAccepted ? null : brokerMessage,
    });

    if (logError) {
      return json(
        {
          success: false,
          step: "trade_log_insert",
          error: logError.message,
          payloadSent: orderPayload,
          raw: tradeData,
        },
        500,
      );
    }

    if (!tradeResponse.ok) {
      let errorMessage = brokerMessage || "Trade execution failed.";
      let retryable = false;
      let retryAfter = 0;
      const brokerRejected =
        classification === "rejected" ||
        retcode === 10019 ||
        tradeResponse.status === 400;

      if ([500, 502, 503, 504].includes(tradeResponse.status)) {
        errorMessage = "Trading Layer is temporarily unavailable. Please try again shortly.";
        retryable = true;
        retryAfter = getValue(tradeData, ["retry_after"], 60);
      } else if (tradeResponse.status === 401 || tradeResponse.status === 403) {
        errorMessage = "Trading Layer authorization failed.";
      } else if (tradeResponse.status === 429) {
        errorMessage = "Too many requests. Please wait and try again.";
        retryable = true;
        retryAfter = 60;
      } else if (tradeResponse.status === 409) {
        errorMessage = "Duplicate trade request detected. Please refresh and try again.";
      }

      return json(
        {
          success: false,
          step: "trade_execution",
          status: brokerRejected ? "rejected" : "failed",
          error: errorMessage,
          tradingLayerStatus: tradeResponse.status,
          retryable,
          retryAfter,
          classification,
          retcode,
          retcodeName,
          retcodeDescription: brokerMessage,
          payloadSent: orderPayload,
          raw: tradeData,
        },
        brokerRejected ? 200 : tradeResponse.status,
      );
    }

    if (!isAccepted) {
      return json(
        {
          success: false,
          step: "trade_execution",
          status: "rejected",
          error: brokerMessage || "Trade was rejected by the broker.",
          classification,
          retcode,
          retcodeName,
          retcodeDescription: brokerMessage,
          payloadSent: orderPayload,
          raw: tradeData,
        },
        200,
      );
    }

    // ---- After-trade sync: best-effort journal insert ONLY.
    // mt_positions writes have been removed — live positions come from
    // Trading Layer directly. Audit data lives in execution_audit_events.
    const syncMeta: Record<string, unknown> = {
      started_at: new Date().toISOString(),
      steps: [] as Array<Record<string, unknown>>,
    };
    const recordStep = (step: Record<string, unknown>) => {
      (syncMeta.steps as Array<Record<string, unknown>>).push({
        at: new Date().toISOString(),
        ...step,
      });
    };

    const orderTicket = (() => {
      const v = getValue(result, [
        "deal.ticket", "order.ticket", "ticket",
        "data.deal.ticket", "data.order.ticket",
        "order_id", "orderId", "deal_id", "dealId",
      ], null);
      return v != null ? String(v) : null;
    })();
    const positionId = (() => {
      const v = getValue(result, [
        "position.id", "position_id", "positionId",
        "deal.position_id", "order.position_id",
        "data.position.id", "data.position_id",
      ], null);
      return v != null ? String(v) : null;
    })();

    try {
      const dealPrice = toNullableNumber(
        getValue(result, [
          "deal.price", "order.price", "price",
          "data.deal.price", "data.order.price",
          "result.price", "trade.price",
        ], null),
      );
      const dealVolume = toNullableNumber(
        getValue(result, ["deal.volume", "order.volume", "volume"], null),
      ) ?? volume;
      const direction = side === "sell" ? "short" : "long";

      // JOURNAL — plain insert. If a duplicate broker_ticket exists we
      // swallow the error to keep this best-effort and never block the
      // trade response. No reliance on a unique constraint.
      if (orderTicket) {
        const { data: existing } = await supabase
          .from("trade_journal")
          .select("id")
          .eq("user_id", user.id)
          .eq("broker_ticket", orderTicket)
          .maybeSingle();
        if (!existing) {
          const { data: jIns, error: jErr } = await supabase
            .from("trade_journal")
            .insert({
              user_id: user.id,
              pair: symbol,
              direction,
              entry_price: dealPrice ?? 0,
              position_size: dealVolume,
              stop_loss: stopLoss ?? null,
              take_profit: takeProfit ?? null,
              status: "open",
              opened_at: new Date().toISOString(),
              setup_tag: "terminal",
              broker_ticket: orderTicket,
              broker_position_id: positionId,
              notes: `Auto-logged from terminal trade. Ticket #${orderTicket}.`,
            })
            .select("id")
            .maybeSingle();
          recordStep({
            step: "journal_insert",
            ok: !jErr,
            ticket: orderTicket,
            position_id: positionId,
            inserted_id: jIns?.id ?? null,
            error: jErr?.message ?? null,
          });
        } else {
          recordStep({ step: "journal_skip_existing", ticket: orderTicket });
        }
      }

      // mt_positions sync intentionally removed — UI reads live positions
      // from Trading Layer via get-live-account.
      recordStep({ step: "positions_sync_skipped", reason: "mt_positions_disabled" });
    } catch (syncErr) {
      recordStep({
        step: "sync_exception",
        error: syncErr instanceof Error ? syncErr.message : String(syncErr),
      });
      console.error("execute-trade: post-trade sync failed", syncErr);
    }

    (syncMeta as any).finished_at = new Date().toISOString();

    // Persist sync diagnostics on the execution log row we created above.
    try {
      await supabase
        .from("trade_execution_logs")
        .update({ sync_meta: syncMeta })
        .eq("user_id", user.id)
        .eq("signal_id", tradeId);
    } catch (metaErr) {
      console.warn("execute-trade: could not persist sync_meta", metaErr);
    }


    return json(
      {
        success: true,
        step: "trade_execution",
        status: finalStatus,
        message: `Trade ${finalStatus}.`,
        classification,
        retcode,
        retcodeName,
        retcodeDescription: brokerMessage,
        payloadSent: orderPayload,
        ticket: orderTicket,
        positionId,
        sync: syncMeta,
        raw: tradeData,
      },
      200,
    );
  } catch (err) {
    return json(
      {
        success: false,
        step: "unhandled_exception",
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});
