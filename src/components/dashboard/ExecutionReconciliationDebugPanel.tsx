import { useEffect, useState } from "react";

// Map MT5 retcodes to short names/descriptions for quick reading in the panel.
const RETCODE_MAP: Record<number, { name: string; description: string }> = {
  10004: { name: "REQUOTE", description: "Requote" },
  10006: { name: "REJECT", description: "Request rejected" },
  10007: { name: "CANCEL", description: "Request canceled by trader" },
  10008: { name: "PLACED", description: "Order placed (accepted, NOT confirmed as filled)" },
  10009: { name: "DONE", description: "Request completed (filled)" },
  10010: { name: "DONE_PARTIAL", description: "Only part of the request was completed" },
  10011: { name: "ERROR", description: "Request processing error" },
  10012: { name: "TIMEOUT", description: "Request canceled by timeout" },
  10013: { name: "INVALID", description: "Invalid request" },
  10014: { name: "INVALID_VOLUME", description: "Invalid volume in the request" },
  10015: { name: "INVALID_PRICE", description: "Invalid price in the request" },
  10016: { name: "INVALID_STOPS", description: "Invalid stops in the request" },
  10017: { name: "TRADE_DISABLED", description: "Trade is disabled" },
  10018: { name: "MARKET_CLOSED", description: "Market is closed" },
  10019: { name: "NO_MONEY", description: "Not enough money to complete the request" },
  10020: { name: "PRICE_CHANGED", description: "Prices changed" },
  10021: { name: "PRICE_OFF", description: "No quotes to process the request" },
  10022: { name: "INVALID_EXPIRATION", description: "Invalid order expiration date" },
  10027: { name: "TRADE_DISABLED", description: "Autotrading disabled by client terminal" },
};

export interface ExecutionReconcileDebugPayload {
  at: string;
  /** "open" | "close" | "partial_close" — defaults to "open" for back-compat. */
  kind?: "open" | "close" | "partial_close";
  account: {
    account_number?: string | number | null;
    server?: string | null;
    trading_layer_trader_id?: string | null;
    metaapi_account_id?: string | null;
    local_row_id?: string | null;
    accountIdUsed?: string | null;
  };
  ids?: {
    tradeId?: string | null;
    clientOrderId?: string | null;
    clientCloseId?: string | null;
    requestId?: string | null;
    orderId?: string | null;
    dealId?: string | null;
    positionTicket?: string | number | null;
    brokerSymbol?: string | null;
    displaySymbol?: string | null;
  };
  request: {
    symbol: string;
    side: string;
    volume: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    deviation?: number | null;
    endpoint: string;
    originalVolume?: number | null;
    closeVolume?: number | null;
    remainingVolumeExpected?: number | null;
  };
  response: {
    retcode: number | null;
    retcodeName?: string | null;
    retcodeDescription?: string | null;
    classification: string | null;
    brokerAccepted?: boolean | null;
    mt5Confirmed?: boolean | null;
    confirmationStatus?: string | null;
    status?: string | null;
    raw: any;
  };
  reconciliation: {
    positionsBefore: any[];
    positionsAfter: any[];
    matchFound: boolean;
    confirmedTicket: string | number | null;
    attempts?: number | null;
    lastAttemptAt?: string | null;
    sourcesChecked?: { positions?: boolean | null; orders?: boolean | null; deals?: boolean | null } | null;
    matchingMode?: "positionTicket" | "dealId" | "orderId" | "requestId" | "fallback" | null;
    matchedTicket?: string | number | null;
    matchedDealId?: string | null;
    matchedOrderId?: string | null;
  };
  history?: {
    matchingPendingOrderFound: boolean | null;
    matchingDealFound: boolean | null;
  };
  /** Backend timing breakpoints (ms epoch). Only present when devMode=true. */
  timings?: Record<string, number | null | undefined> | null;
  /** Frontend-derived durations in ms. */
  durations?: {
    authMs?: number | null;
    accountResolveMs?: number | null;
    riskValidationMs?: number | null;
    freshTickMs?: number | null;
    tradingLayerRoundTripMs?: number | null;
    backendTotalMs?: number | null;
    clickToBrokerAcceptedMs?: number | null;
    clickToFirstReconcileMs?: number | null;
    clickToConfirmedMs?: number | null;
  } | null;
}

const fmtNum = (v: any, d = 2): string => {
  const n = Number(v);
  return v == null || Number.isNaN(n) ? "—" : n.toFixed(d);
};

const PositionsTable = ({ rows, label }: { rows: any[]; label: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
      {label} ({rows?.length ?? 0})
    </div>
    {!rows || rows.length === 0 ? (
      <div className="text-[10px] text-neutral-600 italic">No positions</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] text-neutral-200">
          <thead className="text-neutral-500">
            <tr>
              <th className="text-left pr-2 font-medium">Ticket</th>
              <th className="text-left pr-2 font-medium">Symbol</th>
              <th className="text-left pr-2 font-medium">Side</th>
              <th className="text-right pr-2 font-medium">Vol</th>
              <th className="text-right pr-2 font-medium">Entry</th>
              <th className="text-right pr-2 font-medium">Current</th>
              <th className="text-right pr-2 font-medium">P/L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i} className="border-t border-neutral-900">
                <td className="pr-2 font-mono">{String(p?.ticket ?? p?.id ?? "—")}</td>
                <td className="pr-2">{p?.symbol ?? "—"}</td>
                <td className="pr-2">{p?.side ?? p?.type ?? "—"}</td>
                <td className="pr-2 text-right font-mono">{fmtNum(p?.volume ?? p?.lots, 2)}</td>
                <td className="pr-2 text-right font-mono">{fmtNum(p?.entry_price ?? p?.price_open, 5)}</td>
                <td className="pr-2 text-right font-mono">{fmtNum(p?.current_price, 5)}</td>
                <td className="pr-2 text-right font-mono">{fmtNum(p?.profit, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const ExecutionReconciliationDebugPanel = () => {
  const [runs, setRuns] = useState<ExecutionReconcileDebugPayload[]>([]);

  useEffect(() => {
    const onDbg = (e: Event) => {
      const ce = e as CustomEvent<ExecutionReconcileDebugPayload>;
      if (!ce.detail) return;
      setRuns((prev) => [ce.detail, ...prev].slice(0, 10));
    };
    window.addEventListener("mt:execution-reconcile-debug", onDbg as EventListener);
    return () => window.removeEventListener("mt:execution-reconcile-debug", onDbg as EventListener);
  }, []);

  return (
    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05]">
          Execution Reconciliation Debug (Dev)
        </div>
        <div className="text-[10px] text-neutral-500">{runs.length} run(s)</div>
      </div>

      {runs.length === 0 ? (
        <div className="text-[10px] text-neutral-500 italic">
          Waiting for next order attempt…
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((r, idx) => {
            const rc = r.response.retcode;
            const meta = rc != null ? RETCODE_MAP[rc] : undefined;
            return (
              <details
                key={`${r.at}-${idx}`}
                open={idx === 0}
                className="rounded border border-neutral-900 bg-black/40"
              >
                <summary className="cursor-pointer select-none px-2 py-1.5 text-[10.5px] text-neutral-200">
                  <span className="font-mono text-neutral-500">{new Date(r.at).toLocaleTimeString()}</span>
                  {" · "}
                  <span className="font-semibold">{r.request.symbol}</span>
                  {" · "}
                  <span className="uppercase">{r.request.side}</span>
                  {" · "}
                  <span className="font-mono">{fmtNum(r.request.volume, 2)}</span>
                  {" · retcode="}
                  <span className="font-mono">{rc ?? "—"}</span>
                  {meta && <span className="text-neutral-500"> ({meta.name})</span>}
                  {" · "}
                  <span className={r.reconciliation.matchFound ? "text-emerald-400" : "text-amber-400"}>
                    {r.reconciliation.matchFound ? "MATCHED" : "NO MATCH"}
                  </span>
                </summary>

                <div className="px-3 pb-3 pt-1 space-y-3 text-[10.5px]">
                  {/* 1. Account */}
                  <section>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Connected Account</div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-neutral-200">
                      <div><span className="text-neutral-500">account: </span>{r.account.account_number ?? "—"}</div>
                      <div><span className="text-neutral-500">server: </span>{r.account.server ?? "—"}</div>
                      <div><span className="text-neutral-500">trader_id: </span>{r.account.trading_layer_trader_id ?? "—"}</div>
                    </div>
                  </section>

                  {/* 2. Order Request */}
                  <section>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Order Request</div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-neutral-200">
                      <div><span className="text-neutral-500">symbol: </span>{r.request.symbol}</div>
                      <div><span className="text-neutral-500">side: </span>{r.request.side}</div>
                      <div><span className="text-neutral-500">volume: </span>{fmtNum(r.request.volume, 2)}</div>
                      <div><span className="text-neutral-500">SL: </span>{r.request.stopLoss ?? "—"}</div>
                      <div><span className="text-neutral-500">TP: </span>{r.request.takeProfit ?? "—"}</div>
                      <div><span className="text-neutral-500">deviation: </span>{r.request.deviation ?? "—"}</div>
                      <div className="col-span-3 break-all"><span className="text-neutral-500">endpoint: </span>{r.request.endpoint}</div>
                    </div>
                  </section>

                  {/* 3. Trading Layer Response */}
                  <section>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Trading Layer Response</div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-neutral-200">
                      <div><span className="text-neutral-500">retcode: </span>{rc ?? "—"}</div>
                      <div><span className="text-neutral-500">retcodeName: </span>{meta?.name ?? "—"}</div>
                      <div><span className="text-neutral-500">classification: </span>{r.response.classification ?? "—"}</div>
                    </div>
                    <div className="mt-1 text-neutral-400">
                      <span className="text-neutral-500">retcodeDescription: </span>
                      {meta?.description ?? "—"}
                    </div>
                    <pre className="mt-1 max-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded bg-neutral-950 p-2 text-[10px] text-neutral-300 border border-neutral-900">
{JSON.stringify(r.response.raw, null, 2)}
                    </pre>
                  </section>

                  {/* 4. MT5 Reconciliation */}
                  <section className="space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">MT5 Reconciliation</div>
                    <PositionsTable rows={r.reconciliation.positionsBefore} label="Positions BEFORE" />
                    <PositionsTable rows={r.reconciliation.positionsAfter} label="Positions AFTER" />
                    <div className="font-mono text-neutral-200">
                      <span className="text-neutral-500">matching position found: </span>
                      <span className={r.reconciliation.matchFound ? "text-emerald-400" : "text-amber-400"}>
                        {r.reconciliation.matchFound ? "yes" : "no"}
                      </span>
                      {" · "}
                      <span className="text-neutral-500">confirmed ticket: </span>
                      {r.reconciliation.confirmedTicket ?? "—"}
                    </div>
                  </section>

                  {/* 5. History */}
                  <section>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Pending / Deal History</div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-neutral-200">
                      <div>
                        <span className="text-neutral-500">matching pending order found: </span>
                        {r.history?.matchingPendingOrderFound == null
                          ? "—"
                          : r.history.matchingPendingOrderFound
                          ? "yes"
                          : "no"}
                      </div>
                      <div>
                        <span className="text-neutral-500">matching deal found: </span>
                        {r.history?.matchingDealFound == null
                          ? "—"
                          : r.history.matchingDealFound
                          ? "yes"
                          : "no"}
                      </div>
                    </div>
                  </section>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExecutionReconciliationDebugPanel;
