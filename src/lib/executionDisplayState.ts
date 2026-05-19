/**
 * Canonical mapping from (broker response + live MT5 position) → UI display state.
 * The ONLY way the UI is allowed to show "ORDER EXECUTED" is when a confirmed
 * live MT5 position is provided. Broker response alone is never enough.
 */

export type ExecutionDisplayStatus =
  | "CONFIRMED"
  | "PENDING"
  | "FAILED"
  | "UNKNOWN";

export interface ExecutionDisplayState {
  title: string;
  status: ExecutionDisplayStatus;
  mt5Confirmed: boolean;
  confirmationStatus: "confirmed" | "pending" | "failed" | "not_found";
  confirmedTicket: string | number | null;
  confirmedEntryPrice: number | null;
  confirmedVolume: number | null;
}

export interface BrokerResultLike {
  success?: boolean;
  status?: string;
  retcode?: number | string;
  liveOrderSent?: boolean;
}

export interface ConfirmedPositionLike {
  ticket?: string | number | null;
  entry_price?: number | null;
  price_open?: number | null;
  openPrice?: number | null;
  volume?: number | null;
  lots?: number | null;
}

export function getExecutionDisplayState(
  result: BrokerResultLike | null | undefined,
  confirmedPosition: ConfirmedPositionLike | null | undefined,
): ExecutionDisplayState {
  if (confirmedPosition?.ticket) {
    return {
      title: "ORDER EXECUTED",
      status: "CONFIRMED",
      mt5Confirmed: true,
      confirmationStatus: "confirmed",
      confirmedTicket: confirmedPosition.ticket,
      confirmedEntryPrice:
        confirmedPosition.entry_price ??
        confirmedPosition.price_open ??
        confirmedPosition.openPrice ??
        null,
      confirmedVolume: confirmedPosition.volume ?? confirmedPosition.lots ?? null,
    };
  }

  if (
    result?.liveOrderSent === true ||
    result?.status === "placed" ||
    Number(result?.retcode) === 10008
  ) {
    return {
      title: "ORDER SENT — CONFIRMATION PENDING",
      status: "PENDING",
      mt5Confirmed: false,
      confirmationStatus: "pending",
      confirmedTicket: null,
      confirmedEntryPrice: null,
      confirmedVolume: null,
    };
  }

  if (
    result?.success === false ||
    result?.status === "failed" ||
    result?.status === "rejected"
  ) {
    return {
      title: "ORDER REJECTED",
      status: "FAILED",
      mt5Confirmed: false,
      confirmationStatus: "failed",
      confirmedTicket: null,
      confirmedEntryPrice: null,
      confirmedVolume: null,
    };
  }

  return {
    title: "ORDER STATUS UNKNOWN",
    status: "UNKNOWN",
    mt5Confirmed: false,
    confirmationStatus: "not_found",
    confirmedTicket: null,
    confirmedEntryPrice: null,
    confirmedVolume: null,
  };
}
