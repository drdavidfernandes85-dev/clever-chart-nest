import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { liveMarketDataStore } from "@/lib/liveMarketDataStore";
import { MarketDataService } from "@/services/MarketDataService";

export type ConfirmationStatus =
  | "queued"
  | "checking"
  | "broker_accepted_pending_confirmation"
  | "confirmation_delayed_rate_limited"
  | "position_confirmed"
  | "pending_order_placed"
  | "order_found_not_filled"
  | "order_rejected"
  | "unconfirmed_after_reconciliation";

export interface ConfirmationJobInput {
  tradeId: string;
  clientOrderId?: string | null;
  requestId?: string | null;
  orderId?: string | null;
  dealId?: string | null;
  positionTicket?: string | number | null;
  brokerSymbol?: string | null;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  requestedPrice?: number | null;
  retcode?: number | string | null;
  brokerMessage?: string | null;
  clientClickAt?: string | null;
  rawExecutionResponse?: any;
  traderId?: string | null;
  accountId?: string | null;
}

export interface ConfirmationState extends ConfirmationJobInput {
  status: ConfirmationStatus;
  nextCheckAt: number | null;
  attempts: number;
  lastSourcesChecked: Record<string, boolean | null> | null;
  lastSourcesSkipped: Record<string, string | null> | null;
  lastRateLimit: { retryAfter: number | null; cooldownUntil: number | null; endpoint: string | null } | null;
  lastMatch: any | null;
  lastEndpointCalled: string | null;
  lastHttpStatus: number | null;
  targetLookupMode: "positionTicket" | "dealId" | "orderId" | "requestId" | "fallback";
  cachedStateUsed: boolean;
  idsPresent: boolean;
  message?: string | null;
}

type Listener = (snapshot: Record<string, ConfirmationState>) => void;

const jobs = new Map<string, ConfirmationState>();
const timers = new Map<string, number>();
const listeners = new Set<Listener>();
const inFlightAccounts = new Set<string>();
const cooldowns = new Map<string, { until: number; retryAfter: number; endpoint: string | null; avoided: number }>();

const emit = () => {
  const snapshot = Object.fromEntries(jobs.entries());
  listeners.forEach((l) => l(snapshot));
  window.dispatchEvent(new CustomEvent("mt:confirmation-coordinator", { detail: diagnostics() }));
};

const getTargetLookupMode = (j: Partial<ConfirmationJobInput>): ConfirmationState["targetLookupMode"] =>
  j.positionTicket ? "positionTicket" : j.dealId ? "dealId" : j.orderId ? "orderId" : j.requestId || j.clientOrderId ? "requestId" : "fallback";

const schedule = (tradeId: string, delayMs: number) => {
  const existing = timers.get(tradeId);
  if (existing != null) window.clearTimeout(existing);
  const job = jobs.get(tradeId);
  if (job) {
    job.nextCheckAt = Date.now() + delayMs;
    emit();
  }
  timers.set(tradeId, window.setTimeout(() => void runCheck(tradeId), Math.max(0, delayMs)));
};

const scheduleForAttempt = (job: ConfirmationState) => {
  const hasStrongId = !!(job.positionTicket || job.dealId);
  const cadence = hasStrongId ? [0, 1500, 4000, 10000] : [750, 3000, 8000, 15000];
  if (job.attempts >= cadence.length) {
    job.status = job.status === "confirmation_delayed_rate_limited" ? job.status : "unconfirmed_after_reconciliation";
    job.nextCheckAt = null;
    emit();
    return;
  }
  schedule(job.tradeId, cadence[job.attempts]);
};

const sideOf = (value: any): "buy" | "sell" | null => {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("buy") || s === "0") return "buy";
  if (s.includes("sell") || s === "1") return "sell";
  return null;
};

const cachedPositionMatch = (job: ConfirmationState) => {
  const state = liveMarketDataStore.getState();
  const fresh = state.diagnostics.lastTickAt && Date.now() - state.diagnostics.lastTickAt < 5000;
  if (!fresh) return null;
  const wantTicket = job.positionTicket != null ? String(job.positionTicket) : null;
  const wantSym = (job.brokerSymbol || job.symbol).toUpperCase();
  return state.positions.find((p: any) => {
    const ticket = String(p?.ticket ?? p?.id ?? "");
    if (wantTicket && ticket === wantTicket) return true;
    const sym = String(p?.symbol ?? "").toUpperCase();
    const vol = Number(p?.volume ?? p?.lots ?? 0);
    return sym === wantSym && sideOf(p?.side ?? p?.type) === job.side && Math.abs(vol - job.volume) <= 0.005;
  }) ?? null;
};

async function runCheck(tradeId: string) {
  const job = jobs.get(tradeId);
  if (!job) return;
  const accountKey = job.traderId || job.accountId || "active";
  const cooldown = cooldowns.get(accountKey);
  if (cooldown && cooldown.until > Date.now()) {
    cooldown.avoided += 1;
    job.status = "confirmation_delayed_rate_limited";
    job.nextCheckAt = cooldown.until;
    job.lastRateLimit = { retryAfter: Math.ceil((cooldown.until - Date.now()) / 1000), cooldownUntil: cooldown.until, endpoint: cooldown.endpoint };
    job.message = "Order accepted. Confirmation is delayed due to connection limits. We will check again automatically.";
    emit();
    schedule(tradeId, cooldown.until - Date.now() + 250);
    return;
  }
  if (inFlightAccounts.has(accountKey)) {
    schedule(tradeId, 1000);
    return;
  }
  const cached = cachedPositionMatch(job);
  if (cached) {
    job.status = "position_confirmed";
    job.lastMatch = cached;
    job.cachedStateUsed = true;
    job.nextCheckAt = null;
    emit();
    window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
    return;
  }

  inFlightAccounts.add(accountKey);
  job.status = "checking";
  job.attempts += 1;
  emit();
  try {
    const { data } = await supabase.functions.invoke("reconcile-execution", {
      body: {
        tradeId: job.tradeId,
        symbol: job.symbol,
        side: job.side,
        volume: job.volume,
        requestedPrice: job.requestedPrice ?? null,
        clientClickAt: job.clientClickAt ?? new Date().toISOString(),
        brokerRetcode: job.retcode ?? null,
        brokerMessage: job.brokerMessage ?? null,
        positionTicket: job.positionTicket ?? null,
        orderId: job.orderId ?? null,
        dealId: job.dealId ?? null,
        requestId: job.requestId ?? null,
        clientOrderId: job.clientOrderId ?? job.tradeId,
        brokerSymbol: job.brokerSymbol ?? job.symbol,
        rawExecutionResponse: job.rawExecutionResponse ?? null,
      },
    });
    const rec = data ?? {};
    job.status = rec.status ?? "broker_accepted_pending_confirmation";
    job.lastSourcesChecked = rec.sourcesChecked ?? null;
    job.lastSourcesSkipped = rec.sourcesSkipped ?? null;
    job.lastEndpointCalled = rec.confirmationCoordinator?.lastEndpointCalled ?? rec.endpointRateLimited ?? null;
    job.lastHttpStatus = rec.confirmationCoordinator?.lastHttpStatus ?? null;
    job.lastMatch = rec.confirmedTicket || rec.matchedTicket || rec.matchedDealId || rec.matchedOrderId || null;
    job.message = rec.explanation ?? job.message ?? null;
    if (rec.rateLimitHit || rec.status === "confirmation_delayed_rate_limited") {
      const retryAfter = Number(rec.retryAfter) > 0 ? Number(rec.retryAfter) : 60;
      const until = rec.nextReconcileAt ? new Date(rec.nextReconcileAt).getTime() : Date.now() + retryAfter * 1000;
      cooldowns.set(accountKey, { until, retryAfter, endpoint: rec.endpointRateLimited ?? job.lastEndpointCalled, avoided: 0 });
      job.status = "confirmation_delayed_rate_limited";
      job.lastRateLimit = { retryAfter, cooldownUntil: until, endpoint: rec.endpointRateLimited ?? null };
      job.nextCheckAt = until;
      toast.warning("Order accepted. Confirmation is delayed due to connection limits. We will check again automatically.");
      schedule(tradeId, until - Date.now() + 250);
    } else if (["position_confirmed", "pending_order_placed", "order_found_not_filled", "order_rejected"].includes(job.status)) {
      job.nextCheckAt = null;
      MarketDataService.refreshAccountAndPositions();
      window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
    } else {
      scheduleForAttempt(job);
    }
  } finally {
    inFlightAccounts.delete(accountKey);
    emit();
  }
}

export function enqueueConfirmation(input: ConfirmationJobInput) {
  const current = jobs.get(input.tradeId);
  const state: ConfirmationState = {
    ...(current ?? {}),
    ...input,
    status: current?.status ?? "queued",
    nextCheckAt: current?.nextCheckAt ?? null,
    attempts: current?.attempts ?? 0,
    lastSourcesChecked: current?.lastSourcesChecked ?? null,
    lastSourcesSkipped: current?.lastSourcesSkipped ?? null,
    lastRateLimit: current?.lastRateLimit ?? null,
    lastMatch: current?.lastMatch ?? null,
    lastEndpointCalled: current?.lastEndpointCalled ?? null,
    lastHttpStatus: current?.lastHttpStatus ?? null,
    targetLookupMode: getTargetLookupMode(input),
    cachedStateUsed: false,
    idsPresent: !!(input.requestId || input.orderId || input.dealId || input.positionTicket),
  };
  jobs.set(input.tradeId, state);
  emit();
  scheduleForAttempt(state);
  return state;
}

export function retryConfirmation(input: ConfirmationJobInput) {
  const accountKey = input.traderId || input.accountId || "active";
  const cooldown = cooldowns.get(accountKey);
  if (cooldown && cooldown.until > Date.now()) {
    toast.warning(`Confirmation check is temporarily limited. Next check available in ${Math.ceil((cooldown.until - Date.now()) / 1000)} seconds.`);
    return enqueueConfirmation({ ...input, rawExecutionResponse: input.rawExecutionResponse });
  }
  const state = enqueueConfirmation(input);
  schedule(input.tradeId, 0);
  return state;
}

export function subscribeConfirmation(listener: Listener) {
  listeners.add(listener);
  listener(Object.fromEntries(jobs.entries()));
  return () => { listeners.delete(listener); };
}

export function diagnostics() {
  const active = Array.from(jobs.values()).filter((j) => j.nextCheckAt || j.status === "checking");
  const cooldown = Array.from(cooldowns.entries()).find(([, c]) => c.until > Date.now());
  const current = active[0] ?? Array.from(jobs.values())[0] ?? null;
  return {
    activeJobsCount: active.length,
    currentTradeId: current?.tradeId ?? null,
    coordinatorStatus: current?.status ?? "idle",
    nextCheckTime: current?.nextCheckAt ? new Date(current.nextCheckAt).toISOString() : null,
    accountLevelCooldownUntil: cooldown ? new Date(cooldown[1].until).toISOString() : null,
    requestsAvoidedDuringCooldown: cooldown?.[1].avoided ?? 0,
    lastEndpointCalled: current?.lastEndpointCalled ?? null,
    lastHttpStatus: current?.lastHttpStatus ?? null,
    targetLookupMode: current?.targetLookupMode ?? null,
    cachedStateUsed: current?.cachedStateUsed ?? false,
    trades: Object.fromEntries(jobs.entries()),
  };
}

export const executionConfirmationCoordinator = {
  enqueue: enqueueConfirmation,
  retry: retryConfirmation,
  subscribe: subscribeConfirmation,
  diagnostics,
};