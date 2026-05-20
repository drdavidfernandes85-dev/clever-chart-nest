import { useEffect, useState } from "react";
import {
  getMemoryInfo,
  getMountedHeavy,
  getNetStats,
  startPerfNetObserver,
  subscribePerfRegistry,
} from "@/lib/perfRegistry";

/**
 * Dev/Admin-only Performance Diagnostics panel.
 *
 *  - active polling loops          (see MarketDataDiagnosticsPanel)
 *  - requests/min                  (from PerformanceObserver, all fetch/xhr)
 *  - largest request sources       (top hosts by count)
 *  - last failed request           (status + url)
 *  - currently mounted heavy components
 *  - render count warnings
 *  - JS heap usage (when available)
 *  - last performance scan time
 */
const PerformanceDiagnosticsPanel = () => {
  const [, force] = useState(0);

  useEffect(() => {
    startPerfNetObserver();
    const unsub = subscribePerfRegistry(() => force((n) => n + 1));
    const id = setInterval(() => force((n) => n + 1), 2000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, []);

  const net = getNetStats();
  const heavy = getMountedHeavy();
  const mem = getMemoryInfo();

  const reqHigh = net.requestsPerMinute >= 60;
  const reqMid = net.requestsPerMinute >= 30 && !reqHigh;
  const memHigh = mem && mem.usedMB / mem.limitMB > 0.8;

  return (
    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05]">
          Performance Diagnostics (Dev)
        </div>
        <span className="text-[10px] text-neutral-500">
          last scan {net.lastScanAt ? new Date(net.lastScanAt).toLocaleTimeString() : "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-neutral-200">
        <div>
          <span className="text-neutral-500">total req/min (all fetch/xhr): </span>
          <span className={reqHigh ? "text-red-400" : reqMid ? "text-amber-400" : "text-emerald-400"}>
            {net.requestsPerMinute}
          </span>
          <span className="text-neutral-500"> · target &lt;30 / max 60</span>
        </div>
        <div>
          <span className="text-neutral-500">JS heap: </span>
          {mem ? (
            <span className={memHigh ? "text-amber-400" : ""}>
              {mem.usedMB} / {mem.limitMB} MB
            </span>
          ) : (
            "n/a"
          )}
        </div>

        <div className="col-span-2">
          <div className="text-neutral-500 mb-0.5">top sources (last 60s):</div>
          {net.topSources.length === 0 ? (
            <div className="text-neutral-600">—</div>
          ) : (
            <ul className="space-y-0.5">
              {net.topSources.map((s) => (
                <li key={s.host} className="flex justify-between gap-2">
                  <span className="truncate">{s.host}</span>
                  <span className="text-neutral-400">
                    {s.count}× · {(s.bytes / 1024).toFixed(1)} KB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-2">
          <span className="text-neutral-500">last failed request: </span>
          {net.lastFailed ? (
            <span className="text-red-400 break-all">
              {net.lastFailed.status} · {net.lastFailed.url}
            </span>
          ) : (
            <span className="text-emerald-400">none</span>
          )}
        </div>

        <div className="col-span-2">
          <div className="text-neutral-500 mb-0.5">
            mounted heavy components ({heavy.length}):
          </div>
          {heavy.length === 0 ? (
            <div className="text-neutral-600">—</div>
          ) : (
            <ul className="space-y-0.5">
              {heavy.map((h) => {
                const warn = h.renders > 200;
                return (
                  <li key={h.name} className="flex justify-between gap-2">
                    <span className="truncate">
                      {h.name}
                      {h.instances > 1 ? ` ×${h.instances}` : ""}
                    </span>
                    <span className={warn ? "text-amber-400" : "text-neutral-400"}>
                      {h.renders} renders{warn ? " ⚠" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDiagnosticsPanel;
