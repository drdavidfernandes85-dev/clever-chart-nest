// Pure helpers for controlled-close route + DTO + outcome classification.
// These mirror the logic enforced in close-position-controlled/index.ts so
// the route/outcome contract can be regression-tested without invoking the
// full edge function (which requires auth, secrets and live network).

export const BASE_URL = "https://api.trading-layer.com";

export type AssertRouteResult =
  | { ok: true; routeAccountId: string }
  | {
      ok: false;
      error: "CLOSE_EXECUTION_ROUTE_MISMATCH" | "CLOSE_EXECUTION_ROUTE_UNRESOLVED";
      expectedRouteAccountId?: string;
      attemptedRouteAccountId?: string;
      detail?: string;
      brokerCloseMutationDispatched: false;
    };

/**
 * Validates the caller-supplied route accountId against the verified Trading
 * Layer execution route on the active mapping. Refuses traderId-as-route.
 */
export function assertCloseRoute(input: {
  callerRouteAccountId: string | null | undefined;
  mappingRouteAccountId: string | null | undefined; // tradingLayerAccountId
  traderId: string | null | undefined;
}): AssertRouteResult {
  const route = input.mappingRouteAccountId;
  if (!route) {
    return {
      ok: false,
      error: "CLOSE_EXECUTION_ROUTE_UNRESOLVED",
      brokerCloseMutationDispatched: false,
    };
  }
  // Hard guard — never let traderId be used as the route URL accountId
  // when traderId != tradingLayerAccountId.
  if (input.traderId && route === input.traderId && input.traderId !== input.mappingRouteAccountId) {
    return {
      ok: false,
      error: "CLOSE_EXECUTION_ROUTE_MISMATCH",
      detail: "trader_id_used_as_route",
      brokerCloseMutationDispatched: false,
    };
  }
  if (input.callerRouteAccountId && input.callerRouteAccountId !== route) {
    return {
      ok: false,
      error: "CLOSE_EXECUTION_ROUTE_MISMATCH",
      expectedRouteAccountId: route,
      attemptedRouteAccountId: input.callerRouteAccountId,
      brokerCloseMutationDispatched: false,
    };
  }
  return { ok: true, routeAccountId: route };
}

export function buildCloseEndpoint(routeAccountId: string): string {
  return `/api/v1/accounts/${routeAccountId}/trades/send`;
}

export function buildCloseDTO(input: {
  openSide: "buy" | "sell";
  brokerSymbol: string;
  volume: number;
  ticket: number | string;
}) {
  return {
    side: input.openSide === "buy" ? "sell" : "buy",
    symbol: input.brokerSymbol,
    volume: input.volume,
    position: Number(input.ticket),
    deviation: 20,
  } as const;
}

export type CloseOutcome = {
  status: "closed" | "partial_closed" | "close_failed" | "close_rejected";
  outcome: "success" | "rejected" | "failed";
  classification: "controlled_close_accepted" | "controlled_close_broker_rejected" | "controlled_close_dispatch_failed";
  retcode: number | null;
  retcodeName: string | null;
  retcodeDescription: string | null;
  brokerCloseMutationDispatched: boolean;
};

/**
 * Classifies the Trading Layer close response. HTTP 200 alone is NOT
 * acceptance — the nested data.retcode determines broker outcome.
 */
export function classifyCloseOutcome(input: {
  httpStatus: number;
  networkError?: string | null;
  response: any;
  openVolume?: number | null;
  closeVolume?: number;
}): CloseOutcome {
  const res = input.response ?? null;
  const tl = res?.data && typeof res.data === "object" ? res.data : res;
  const retcode = tl?.retcode != null ? Number(tl.retcode) : null;
  const retcodeName = res?.retcodeName ?? tl?.retcode_name ?? null;
  const retcodeDescription = res?.retcodeDescription ?? tl?.retcode_description ?? null;
  const httpOk = input.httpStatus >= 200 && input.httpStatus < 300;
  const brokerCloseMutationDispatched = !input.networkError && input.httpStatus > 0;

  const explicitSuccess = res?.success === true || retcode === 10009 || retcode === 10008;
  const explicitRejection =
    res?.success === false ||
    String(res?.status || tl?.status || tl?.classification || "").toLowerCase() === "rejected" ||
    (retcode != null && retcode >= 10010 && retcode !== 10008);

  if (input.networkError || !httpOk) {
    return {
      status: "close_failed",
      outcome: "failed",
      classification: "controlled_close_dispatch_failed",
      retcode, retcodeName, retcodeDescription,
      brokerCloseMutationDispatched: !!brokerCloseMutationDispatched && !input.networkError,
    };
  }
  if (explicitRejection) {
    return {
      status: "close_rejected",
      outcome: "rejected",
      classification: "controlled_close_broker_rejected",
      retcode, retcodeName, retcodeDescription,
      brokerCloseMutationDispatched: true,
    };
  }
  if (explicitSuccess) {
    const partial =
      input.openVolume != null && Number.isFinite(input.openVolume) &&
      (input.closeVolume ?? 0) + 1e-8 < (input.openVolume as number);
    return {
      status: partial ? "partial_closed" : "closed",
      outcome: "success",
      classification: "controlled_close_accepted",
      retcode, retcodeName, retcodeDescription,
      brokerCloseMutationDispatched: true,
    };
  }
  return {
    status: "close_failed",
    outcome: "failed",
    classification: "controlled_close_dispatch_failed",
    retcode, retcodeName, retcodeDescription,
    brokerCloseMutationDispatched: true,
  };
}

/**
 * After a TL-accepted close, lifecycle PASS requires reconciling that the
 * confirmed ticket no longer appears in live TL positions.
 */
export function evaluateLifecycleAfterAcceptedClose(input: {
  confirmedTicket: string;
  livePositionsAfter: Array<{ ticket: string | number }>;
}): {
  controlledCloseValidationStatus: "passed" | "awaiting_reconciliation";
  fullLifecycleStatus: "passed" | "awaiting_close_confirmation";
  residualExposure: "none" | "detected";
} {
  const stillOpen = input.livePositionsAfter.some(
    (p) => String(p.ticket) === String(input.confirmedTicket),
  );
  if (stillOpen) {
    return {
      controlledCloseValidationStatus: "awaiting_reconciliation",
      fullLifecycleStatus: "awaiting_close_confirmation",
      residualExposure: "detected",
    };
  }
  return {
    controlledCloseValidationStatus: "passed",
    fullLifecycleStatus: "passed",
    residualExposure: "none",
  };
}
