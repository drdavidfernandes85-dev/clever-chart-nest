import {
  useMarketDataDiagnostics,
  useMarketStatus,
  useRateLimit,
} from "@/hooks/useLiveMarketData";
import { MarketDataService } from "@/services/MarketDataService";
import {
  getDuplicateLoops,
  getExternalLoops,
  subscribePollingRegistry,
} from "@/lib/pollingRegistry";
import { useEffect, useState } from "react";
import { terminalRealtimeStore, type TerminalRealtimeState } from "@/stores/terminalRealtimeStore";

/**
 * Dev-Mode diagnostics for the centralized market data layer.
 *
 *  - active polling loops
 *  - symbols being polled
 *  - requests per minute
 *  - last tick timestamp
 *  - rate-limit status + cooldown remaining
 *  - duplicate loops detected
 */
const MarketDataDiagnosticsPanel = () => {
  const diag = useMarketDataDiagnostics();
  const status = useMarketStatus();
  const rl = useRateLimit();
  const [, force] = useState(0);
  const [registry, setRegistry] = useState({
    external: getExternalLoops(),
    duplicates: getDuplicateLoops(),
  });

  // Tick every second so the countdown / "Xs ago" stays fresh.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = subscribePollingRegistry(() =>
      setRegistry({
        external: getExternalLoops(),
        duplicates: getDuplicateLoops(),
      }),
    );
    return unsub;
  }, []);

  const lastTickStr = diag.lastTickAt
    ? new Date(diag.lastTickAt).toLocaleTimeString()
    : "—";
  const lastTickAge = diag.lastTickAt
    ? `${Math.max(0, Math.round((Date.now() - diag.lastTickAt) / 1000))}s ago`
    : "—";

  const rlSecondsLeft = rl.active && rl.resumesAt
    ? Math.max(0, Math.ceil((rl.resumesAt - Date.now()) / 1000))
    : 0;

  const handleRefresh = () => {
    MarketDataService.refreshSelected();
    MarketDataService.refreshWatchlist();
    MarketDataService.refreshAccountAndPositions();
  };

  const dupDetected = registry.duplicates.length > 0;
  const allLoops = [...diag.activeLoops, ...registry.external];

  return (
    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05]">
          Market Data Layer — Diagnostics (Dev)
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500">{status.toUpperCase()}</span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={rl.active}
            className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
            title={rl.active ? "Paused by rate limit" : "Force refresh all loops once"}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-neutral-200">
        <div>
          <span className="text-neutral-500">active loops: </span>
          {allLoops.length === 0 ? "—" : allLoops.join(", ")}
        </div>
        <div>
          <span className="text-neutral-500">req/min (rolling 60s): </span>
          <span className={diag.requestsPerMinute >= 60 ? "text-amber-400" : ""}>
            {diag.requestsPerMinute}
          </span>
          <span className="text-neutral-500"> / 60 budget</span>
        </div>
        <div>
          <span className="text-neutral-500">last tick: </span>
          {lastTickStr} <span className="text-neutral-500">({lastTickAge})</span>
        </div>
        <div>
          <span className="text-neutral-500">rate-limit: </span>
          {rl.active ? (
            <span className="text-amber-400">
              ACTIVE · cooldown {rlSecondsLeft}s
            </span>
          ) : (
            "off"
          )}
        </div>
        <div>
          <span className="text-neutral-500">duplicate loops: </span>
          {dupDetected ? (
            <span className="text-red-400">YES ({registry.duplicates.join(", ")})</span>
          ) : (
            <span className="text-emerald-400">no</span>
          )}
        </div>
        <div>
          <span className="text-neutral-500">external loops: </span>
          {registry.external.length === 0 ? "—" : registry.external.join(", ")}
        </div>
        <div className="col-span-2 break-words">
          <span className="text-neutral-500">polled symbols ({diag.polledSymbols.length}): </span>
          {diag.polledSymbols.length === 0 ? "—" : diag.polledSymbols.join(" · ")}
        </div>
      </div>

      <WsDiagnosticsSection />
    </div>
  );
};

function WsDiagnosticsSection() {
  const [rt, setRt] = useState<TerminalRealtimeState>(terminalRealtimeStore.getState());
  useEffect(() => terminalRealtimeStore.subscribe(setRt), []);
  const lastTickAge =
    rt.lastTickAt != null
      ? `${Math.max(0, Math.round((Date.now() - rt.lastTickAt) / 1000))}s ago`
      : "—";
  const selectedTickAge =
    rt.selectedSymbol && rt.latestTicks[rt.selectedSymbol]
      ? `${Math.max(0, Math.round((Date.now() - rt.latestTicks[rt.selectedSymbol].timestamp) / 1000))}s`
      : "—";
  const connectedSince = rt.connectedSince
    ? new Date(rt.connectedSince).toLocaleTimeString()
    : "—";
  const tone =
    rt.wsMarketDataStatus === "connected"
      ? "text-emerald-400"
      : rt.wsMarketDataStatus === "stale" || rt.wsMarketDataStatus === "reconnecting"
        ? "text-amber-400"
        : rt.wsMarketDataStatus === "error"
          ? "text-red-400"
          : "text-neutral-400";
  return (
    <div className="mt-3 pt-3 border-t border-neutral-800">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05] mb-2">
        Trading Layer Market-Data WebSocket
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-neutral-200">
        <div>
          <span className="text-neutral-500">auth method: </span>
          subprotocol bearer
        </div>
        <div>
          <span className="text-neutral-500">required scope: </span>
          mt5:market-data
        </div>
        <div>
          <span className="text-neutral-500">status: </span>
          <span className={tone}>{rt.wsMarketDataStatus.toUpperCase()}</span>
        </div>
        <div>
          <span className="text-neutral-500">accountId: </span>
          {rt.accountIdMasked ?? "—"}
        </div>
        <div>
          <span className="text-neutral-500">connected since: </span>
          {connectedSince}
        </div>
        <div>
          <span className="text-neutral-500">last tick: </span>
          {lastTickAge}
        </div>
        <div>
          <span className="text-neutral-500">selected tick age: </span>
          {selectedTickAge}
        </div>
        <div>
          <span className="text-neutral-500">reconnect attempts: </span>
          {rt.reconnectAttempts}
        </div>
        <div>
          <span className="text-neutral-500">fallback polling: </span>
          {rt.fallbackPollingActive ? (
            <span className="text-amber-400">ACTIVE</span>
          ) : (
            <span className="text-emerald-400">off</span>
          )}
        </div>
        <div>
          <span className="text-neutral-500">malformed events: </span>
          {rt.malformedEventCount}
        </div>
        <div>
          <span className="text-neutral-500">duplicate socket: </span>
          {rt.duplicateSocketDetected ? (
            <span className="text-red-400">YES</span>
          ) : (
            <span className="text-emerald-400">no</span>
          )}
        </div>
        <div className="break-words">
          <span className="text-neutral-500">ws url: </span>
          {rt.wsUrlMasked ?? "—"}
        </div>
        <div className="col-span-2 break-words">
          <span className="text-neutral-500">subscribed ({rt.subscribedSymbols.length}): </span>
          {rt.subscribedSymbols.length === 0 ? "—" : rt.subscribedSymbols.join(" · ")}
        </div>
        {rt.lastError && (
          <div className="col-span-2 break-words text-red-400">
            <span className="text-neutral-500">last error: </span>
            {rt.lastError}
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketDataDiagnosticsPanel;
