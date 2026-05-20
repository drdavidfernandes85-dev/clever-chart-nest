import { useEffect, useRef, useState, useCallback } from "react";
import { Calendar as CalendarIcon, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Real, live economic calendar — embeds Investing.com's official widget.
 * Data is sourced live from Investing.com (no mock, no edge-function cache).
 * Impact dots, forecast/previous/actual values are rendered by the upstream
 * widget so they always match the real market schedule.
 *
 * Resilience:
 *   - Explicit loading state while the iframe initialises.
 *   - 12s timeout fallback that lets the user retry or open Investing.com in
 *     a new tab if the embed is blocked (ad-blockers, network, etc.).
 */

const LOAD_TIMEOUT_MS = 12_000;
const CALENDAR_URL =
  "https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=2,3&features=datepicker,timezone,timeselector,filters&countries=5,72,17,4,12,17,32,6,37,22&calType=week&timeZone=8&lang=1";

const EconomicCalendarWidget = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "timeout">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const userTz = typeof Intl !== "undefined"
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")
    : "UTC";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setStatus("loading");

    // Reset host
    while (host.firstChild) host.removeChild(host.firstChild);

    const iframe = document.createElement("iframe");
    iframe.src = CALENDAR_URL;
    iframe.title = "Live Economic Calendar";
    iframe.frameBorder = "0";
    iframe.loading = "lazy";
    iframe.setAttribute("allowtransparency", "true");
    iframe.scrolling = "yes";
    iframe.style.width = "100%";
    iframe.style.height = "560px";
    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.onload = () => setStatus((s) => (s === "timeout" ? s : "ready"));
    host.appendChild(iframe);

    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "ready" ? s : "timeout"));
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between bg-secondary/50 px-4 py-2 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">
            Economic Calendar
          </span>
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-primary">
              Live
            </span>
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          data ·{" "}
          <a
            href="https://www.investing.com/economic-calendar/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            investing.com
          </a>
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-1.5 bg-muted/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            <span className="text-[10px] text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="text-[10px] text-muted-foreground">Low</span>
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
          Times: <span className="text-foreground/80">{userTz}</span>
        </span>
      </div>

      <div className="relative w-full bg-card" style={{ minHeight: 560 }}>
        <div ref={hostRef} className="w-full" style={{ minHeight: 560 }} />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading economic calendar…
            </div>
          </div>
        )}

        {status === "timeout" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card p-6 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-foreground mb-1">
                Calendar took too long to load
              </p>
              <p className="text-xs text-muted-foreground">
                The live calendar embed may be blocked by your network or an ad-blocker.
                You can retry or open it directly on investing.com.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={retry}>
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
              <Button size="sm" asChild className="h-8 text-xs">
                <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer">
                  Open on Investing.com
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="border-t border-border/50 bg-muted/5 px-4 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Calendar information is provided for educational and informational purposes only and does not
        constitute investment advice or a recommendation to trade.
      </p>
    </div>
  );
};

export default EconomicCalendarWidget;
