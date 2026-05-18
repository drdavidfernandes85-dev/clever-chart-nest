import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { data: account, error: accountError } = await supabase
      .from("user_mt_accounts")
      .select("id, metaapi_account_id, login, server_name, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError) {
      return json(
        {
          success: false,
          step: "account_lookup",
          error: accountError.message,
        },
        500,
      );
    }

    if (!account?.metaapi_account_id) {
      return json(
        {
          success: false,
          step: "account_lookup",
          error: "No connected MT5 account found.",
        },
        404,
      );
    }

    const accountId = account.metaapi_account_id;
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

    // ---- After-trade sync: populate mt_positions + trade_journal so the
    // Positions and Journal tabs reflect this trade immediately. Best-effort:
    // any failure here is logged but does NOT fail the trade response.
    try {
      const dealPrice = toNullableNumber(
        getValue(result, [
          "deal.price", "order.price", "price",
          "data.deal.price", "data.order.price",
          "result.price", "trade.price",
        ], null),
      );
      const dealTicket = getValue(result, [
        "deal.ticket", "order.ticket", "ticket", "order_id", "orderId",
        "data.deal.ticket", "data.order.ticket",
      ], null);
      const dealVolume = toNullableNumber(
        getValue(result, ["deal.volume", "order.volume", "volume"], null),
      ) ?? volume;
      const direction = side === "sell" ? "short" : "long";

      // 1) Insert an OPEN row in the journal so the user sees the trade now.
      //    We leave pnl/exit blank until the position closes (will be filled
      //    by sync or EA flows). Idempotent on (user, notes ticket) — we use
      //    a "Ticket #" marker so subsequent syncs won't duplicate.
      const journalNotes = dealTicket
        ? `Auto-logged from terminal trade. Ticket #${dealTicket}.`
        : `Auto-logged from terminal trade.`;

      let alreadyJournaled = false;
      if (dealTicket) {
        const { data: existing } = await supabase
          .from("trade_journal")
          .select("id")
          .eq("user_id", user.id)
          .like("notes", `%Ticket #${dealTicket}.%`)
          .maybeSingle();
        alreadyJournaled = !!existing;
      }

      if (!alreadyJournaled) {
        await supabase.from("trade_journal").insert({
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
          notes: journalNotes,
        });
      }

      // 2) Sync mt_positions from Trading Layer so the Positions tab updates.
      if (account?.id) {
        const posRes = await fetch(
          `${BASE_URL}/api/v1/accounts/${accountId}/positions`,
          { headers: { Authorization: `Bearer ${TRADING_LAYER_KEY}` } },
        );
        if (posRes.ok) {
          const posJson: any = await posRes.json().catch(() => ({}));
          const positions: any[] =
            (Array.isArray(posJson?.data) ? posJson.data
              : Array.isArray(posJson?.data?.positions) ? posJson.data.positions
              : Array.isArray(posJson?.positions) ? posJson.positions
              : []) ?? [];

          // Replace open positions for this account
          await supabase.from("mt_positions").delete().eq("account_id", account.id);

          if (positions.length > 0) {
            const rows = positions.map((p: any) => {
              const t = String(p.ticket ?? p.position_id ?? p.id ?? "");
              const sideStr = String(p.side ?? p.type ?? "").toLowerCase();
              const normSide = sideStr === "sell" || sideStr === "short" || sideStr === "1"
                ? "short" : "long";
              return {
                user_id: user.id,
                account_id: account.id,
                ticket: t,
                symbol: String(p.symbol ?? ""),
                side: normSide,
                volume: Number(p.volume ?? p.lots ?? 0),
                open_price: Number(p.open_price ?? p.price_open ?? p.entry ?? 0),
                current_price: p.current_price != null ? Number(p.current_price) : null,
                stop_loss: p.sl != null ? Number(p.sl) : p.stop_loss != null ? Number(p.stop_loss) : null,
                take_profit: p.tp != null ? Number(p.tp) : p.take_profit != null ? Number(p.take_profit) : null,
                profit: p.profit != null ? Number(p.profit) : 0,
                swap: p.swap != null ? Number(p.swap) : null,
                commission: p.commission != null ? Number(p.commission) : null,
                opened_at: p.time
                  ? (Number(p.time) > 0 ? new Date(Number(p.time) * 1000).toISOString() : new Date(p.time).toISOString())
                  : p.opened_at ?? new Date().toISOString(),
              };
            }).filter((r) => r.ticket);

            if (rows.length > 0) {
              await supabase.from("mt_positions").insert(rows);
            }
          }
        } else {
          console.warn("execute-trade: positions sync HTTP", posRes.status);
        }
      }
    } catch (syncErr) {
      console.warn("execute-trade: post-trade sync failed", syncErr);
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
