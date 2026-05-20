import { useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";

/**
 * Dev/Admin-only diagnostics for the broker-symbol source feeding
 * Market Watch and the Order Ticket.
 *
 *  - symbol source: Trading Layer (live) vs curated fallback
 *  - total / visible counts
 *  - selected broker symbol + chart mapping
 *  - last symbol sync time + error
 *  - fallback active yes/no
 *
 * No side effects, no extra polling.
 */
const SymbolSourceDiagnosticsPanel = () => {
  const {
    symbols,
    isLive,
    loading,
    loaded,
    error,
    selectedBrokerSymbol,
    selectedSymbolValid,
    lastResponse,
  } = useBrokerSymbols();

  const fallbackActive = !isLive;
  const total = symbols.length;
  const visible = symbols.length; // Market Watch renders all broker-approved symbols
  const sourceLabel = isLive ? "Trading Layer (MT5)" : "curated fallback";

  // Try to extract a timestamp from the last response, if present.
  const ts =
    (lastResponse as any)?.timestamp ??
    (lastResponse as any)?.fetchedAt ??
    (lastResponse as any)?.serverTime ??
    null;
  const lastSyncStr = ts ? new Date(ts).toLocaleTimeString() : loaded ? "—" : "pending";

  return (
    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05]">
          Symbol Source — Diagnostics (Dev)
        </div>
        <span className="text-[10px] text-neutral-500">
          {loading ? "syncing…" : isLive ? "LIVE" : "FALLBACK"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-neutral-200">
        <div>
          <span className="text-neutral-500">source: </span>
          <span className={isLive ? "text-emerald-400" : "text-amber-400"}>
            {sourceLabel}
          </span>
        </div>
        <div>
          <span className="text-neutral-500">fallback active: </span>
          {fallbackActive ? (
            <span className="text-amber-400">YES</span>
          ) : (
            <span className="text-emerald-400">no</span>
          )}
        </div>
        <div>
          <span className="text-neutral-500">total supported: </span>
          {total}
        </div>
        <div>
          <span className="text-neutral-500">visible: </span>
          {visible}
        </div>
        <div>
          <span className="text-neutral-500">selected: </span>
          <span className={selectedSymbolValid ? "text-emerald-400" : "text-amber-400"}>
            {selectedBrokerSymbol || "—"}
          </span>
          {!selectedSymbolValid && selectedBrokerSymbol ? (
            <span className="text-neutral-500"> (unverified)</span>
          ) : null}
        </div>
        <div>
          <span className="text-neutral-500">last sync: </span>
          {lastSyncStr}
        </div>
        <div className="col-span-2 break-words">
          <span className="text-neutral-500">last sync error: </span>
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            <span className="text-emerald-400">none</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymbolSourceDiagnosticsPanel;
