import {
  useMarketDataDiagnostics,
  useMarketStatus,
  useRateLimit,
} from "@/hooks/useLiveMarketData";

/**
 * Dev-Mode diagnostics for the centralized market data layer.
 *
 *  - active polling loops
 *  - last tick timestamp
 *  - symbols being polled
 *  - requests per minute estimate
 *  - current rate-limit status
 */
const MarketDataDiagnosticsPanel = () => {
  const diag = useMarketDataDiagnostics();
  const status = useMarketStatus();
  const rl = useRateLimit();

  const lastTickStr = diag.lastTickAt
    ? new Date(diag.lastTickAt).toLocaleTimeString()
    : "—";
  const lastTickAge = diag.lastTickAt
    ? `${Math.max(0, Math.round((Date.now() - diag.lastTickAt) / 1000))}s ago`
    : "—";

  return (
    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05]">
          Market Data Layer — Diagnostics (Dev)
        </div>
        <div className="text-[10px] text-neutral-500">{status.toUpperCase()}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-neutral-200">
        <div>
          <span className="text-neutral-500">active loops: </span>
          {diag.activeLoops.length === 0 ? "—" : diag.activeLoops.join(", ")}
        </div>
        <div>
          <span className="text-neutral-500">req/min (rolling 60s): </span>
          {diag.requestsPerMinute}
        </div>
        <div>
          <span className="text-neutral-500">last tick: </span>
          {lastTickStr} <span className="text-neutral-500">({lastTickAge})</span>
        </div>
        <div>
          <span className="text-neutral-500">rate-limit: </span>
          {rl.active
            ? `ACTIVE · resumes ${
                rl.resumesAt
                  ? new Date(rl.resumesAt).toLocaleTimeString()
                  : "—"
              }`
            : "off"}
        </div>
        <div className="col-span-2 break-words">
          <span className="text-neutral-500">polled symbols ({diag.polledSymbols.length}): </span>
          {diag.polledSymbols.length === 0 ? "—" : diag.polledSymbols.join(" · ")}
        </div>
      </div>
    </div>
  );
};

export default MarketDataDiagnosticsPanel;
