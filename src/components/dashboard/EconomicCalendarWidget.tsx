import { useEffect, useRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

/**
 * Real, live economic calendar — embeds Investing.com's official widget.
 * Data is sourced live from Investing.com (no mock, no edge-function cache).
 * Impact dots, forecast/previous/actual values are rendered by the upstream
 * widget so they always match the real market schedule.
 */

const EconomicCalendarWidget = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Reset host
    while (host.firstChild) host.removeChild(host.firstChild);

    // Investing.com economic calendar iframe — official, embeddable
    // Filters: today + tomorrow, all impacts, major currencies
    const iframe = document.createElement("iframe");
    iframe.src =
      "https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=2,3&features=datepicker,timezone,timeselector,filters&countries=5,72,17,4,12,17,32,6,37,22&calType=week&timeZone=8&lang=1";
    iframe.title = "Live Economic Calendar";
    iframe.frameBorder = "0";
    iframe.setAttribute("allowtransparency", "true");
    iframe.scrolling = "yes";
    iframe.style.width = "100%";
    iframe.style.height = "560px";
    iframe.style.border = "0";
    iframe.style.background = "transparent";
    host.appendChild(iframe);
  }, []);

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

      <div className="flex items-center gap-4 border-b border-border px-4 py-1.5 bg-muted/10">
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

      <div ref={hostRef} className="w-full bg-card" style={{ minHeight: 560 }} />
    </div>
  );
};

export default EconomicCalendarWidget;
