/**
 * terminalRealtimeStore
 * ---------------------
 * Display-only realtime tick store fed by the Trading Layer market-data
 * WebSocket (see `tradingLayerMarketDataWebSocket.ts`).
 *
 * IMPORTANT:
 *   - These ticks are for display only.
 *   - All order execution paths MUST continue to validate fresh ticks
 *     server-side before submitting to MT5. Do NOT use this store for
 *     price-of-record in execution.
 *
 * Framework-agnostic pub/sub. The only writer is the WebSocket service.
 */

export type WsMarketDataStatus =
  | "disabled"
  | "connecting"
  | "connected_waiting_ready"
  | "connected_ready_no_subscription"
  | "connected_subscribed_no_ticks"
  | "connected"
  | "connected_no_frames"
  | "reconnecting"
  | "stale"
  | "disconnected"
  | "error";

export type WsSubscribeSchema =
  | "current_json_type"
  | "action_subscribe"
  | "event_subscribe"
  | "method_subscribe"
  | "channel_subscribe"
  | "plain_text"
  | "auto_stream";

export interface RealtimeTick {
  brokerSymbol: string;
  displaySymbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  spread: number | null;
  volume: number | null;
  timestamp: number;
  source: "trading_layer_ws";
}

export interface TerminalRealtimeState {
  wsMarketDataStatus: WsMarketDataStatus;
  selectedSymbol: string;
  subscribedSymbols: string[];
  latestTicks: Record<string, RealtimeTick>;
  lastTickAt: number | null;
  fallbackPollingActive: boolean;
  reconnectAttempts: number;
  malformedEventCount: number;
  duplicateSocketDetected: boolean;
  lastError: string | null;
  tokenExpiresAt: number | null;
  connectedSince: number | null;
  accountIdMasked: string | null;
  wsUrlMasked: string | null;
  subscribeSchema: WsSubscribeSchema;
  lastSubscribeFrame: string | null;
  lastSubscribeSentAt: number | null;
  framesReceived: number;
  tickFramesReceived: number;
  nonTickFramesReceived: number;
  lastNonTickFrameType: string | null;
  lastNonTickFrameSample: string | null;
  lastCloseCode: number | null;
  lastCloseReason: string | null;
  upstreamReady: boolean;
  lastControlFrame: string | null;
  confirmedSubscribedSymbols: string[];
  lastTickSymbol: string | null;
}

type Listener = (s: TerminalRealtimeState) => void;

const initial: TerminalRealtimeState = {
  wsMarketDataStatus: "disabled",
  selectedSymbol: "",
  subscribedSymbols: [],
  latestTicks: {},
  lastTickAt: null,
  fallbackPollingActive: true,
  reconnectAttempts: 0,
  malformedEventCount: 0,
  duplicateSocketDetected: false,
  lastError: null,
  tokenExpiresAt: null,
  connectedSince: null,
  accountIdMasked: null,
  wsUrlMasked: null,
  subscribeSchema: "current_json_type",
  lastSubscribeFrame: null,
  lastSubscribeSentAt: null,
  framesReceived: 0,
  tickFramesReceived: 0,
  nonTickFramesReceived: 0,
  lastNonTickFrameType: null,
  lastNonTickFrameSample: null,
  lastCloseCode: null,
  lastCloseReason: null,
  upstreamReady: false,
  lastControlFrame: null,
  confirmedSubscribedSymbols: [],
  lastTickSymbol: null,
};

let state: TerminalRealtimeState = initial;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      /* ignore */
    }
  }
}

function setState(patch: Partial<TerminalRealtimeState>) {
  state = { ...state, ...patch };
  emit();
}

export const terminalRealtimeStore = {
  getState(): TerminalRealtimeState {
    return state;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /* writer-only — service uses these */
  setStatus(s: WsMarketDataStatus) {
    if (state.wsMarketDataStatus !== s) {
      const isConnectedLike = s === "connected" || s === "connected_no_frames" || s === "stale";
      setState({
        wsMarketDataStatus: s,
        connectedSince:
          isConnectedLike
            ? state.connectedSince ?? Date.now()
            : s === "disconnected" || s === "disabled"
              ? null
              : state.connectedSince,
      });
    }
  },
  setSelectedSymbol(sym: string) {
    setState({ selectedSymbol: (sym || "").toUpperCase() });
  },
  setSubscribedSymbols(syms: string[]) {
    const norm = Array.from(
      new Set(syms.map((s) => (s || "").toUpperCase()).filter(Boolean)),
    ).sort();
    if (
      norm.length !== state.subscribedSymbols.length ||
      norm.some((s, i) => s !== state.subscribedSymbols[i])
    ) {
      setState({ subscribedSymbols: norm });
    }
  },
  applyTick(t: RealtimeTick) {
    const key = (t.brokerSymbol || t.displaySymbol || "").toUpperCase();
    if (!key) return;
    state = {
      ...state,
      latestTicks: { ...state.latestTicks, [key]: t },
      lastTickAt: t.timestamp,
    };
    emit();
  },
  setFallbackPolling(active: boolean) {
    if (state.fallbackPollingActive !== active) {
      setState({ fallbackPollingActive: active });
    }
  },
  incReconnectAttempts() {
    setState({ reconnectAttempts: state.reconnectAttempts + 1 });
  },
  resetReconnectAttempts() {
    if (state.reconnectAttempts !== 0) setState({ reconnectAttempts: 0 });
  },
  incMalformed() {
    setState({ malformedEventCount: state.malformedEventCount + 1 });
  },
  setDuplicateSocket(v: boolean) {
    if (state.duplicateSocketDetected !== v) {
      setState({ duplicateSocketDetected: v });
    }
  },
  setLastError(err: string | null) {
    if (state.lastError !== err) setState({ lastError: err });
  },
  setTokenExpiresAt(ts: number | null) {
    setState({ tokenExpiresAt: ts });
  },
  setMeta(meta: { accountIdMasked?: string | null; wsUrlMasked?: string | null }) {
    setState({
      accountIdMasked:
        meta.accountIdMasked !== undefined
          ? meta.accountIdMasked
          : state.accountIdMasked,
      wsUrlMasked:
        meta.wsUrlMasked !== undefined ? meta.wsUrlMasked : state.wsUrlMasked,
    });
  },
  setSubscribeSchema(s: WsSubscribeSchema) {
    if (state.subscribeSchema !== s) setState({ subscribeSchema: s });
  },
  recordSubscribeFrame(frame: string | null) {
    setState({
      lastSubscribeFrame: frame,
      lastSubscribeSentAt: frame ? Date.now() : state.lastSubscribeSentAt,
    });
  },
  incFrameReceived(isTick: boolean, nonTickType?: string, nonTickSample?: string) {
    state = {
      ...state,
      framesReceived: state.framesReceived + 1,
      tickFramesReceived: state.tickFramesReceived + (isTick ? 1 : 0),
      nonTickFramesReceived: state.nonTickFramesReceived + (isTick ? 0 : 1),
      lastNonTickFrameType: !isTick && nonTickType ? nonTickType : state.lastNonTickFrameType,
      lastNonTickFrameSample: !isTick && nonTickSample ? nonTickSample : state.lastNonTickFrameSample,
    };
    emit();
  },
  recordClose(code: number | null, reason: string | null) {
    setState({ lastCloseCode: code, lastCloseReason: reason });
  },
  reset() {
    state = initial;
    emit();
  },

  /* derived */
  getTickAgeMs(symbol: string): number | null {
    const t = state.latestTicks[(symbol || "").toUpperCase()];
    return t ? Date.now() - t.timestamp : null;
  },
  isSelectedStale(thresholdMs = 8000): boolean {
    if (!state.selectedSymbol) return false;
    const age = terminalRealtimeStore.getTickAgeMs(state.selectedSymbol);
    return age == null || age > thresholdMs;
  },
};

export type TerminalRealtimeStore = typeof terminalRealtimeStore;
