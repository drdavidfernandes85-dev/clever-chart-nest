import { useEffect, useId, useMemo, useRef, useState } from "react";

interface Props {
  symbol?: string;
  interval?: string;
  height?: number | string;
  allowSymbolChange?: boolean;
  hideSideToolbar?: boolean;
  withDateRanges?: boolean;
  saveImage?: boolean;
  calendar?: boolean;
  details?: boolean;
  hotlist?: boolean;
  studies?: string[];
  className?: string;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

let tradingViewLoader: Promise<void> | null = null;

const loadTradingViewScript = () => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.TradingView?.widget) {
    return Promise.resolve();
  }

  if (tradingViewLoader) {
    return tradingViewLoader;
  }

  tradingViewLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://s3.tradingview.com/tv.js"]');

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("TradingView script failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TradingView script failed to load"));
    document.head.appendChild(script);
  });

  return tradingViewLoader;
};

const TradingViewAdvancedIframe = ({
  symbol = "FX:EURUSD",
  interval = "15",
  height = "100%",
  allowSymbolChange = true,
  hideSideToolbar = false,
  withDateRanges = true,
  saveImage = true,
  studies = [],
  className = "",
}: Props) => {
  const containerId = useId().replace(/:/g, "");
  const hostRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  const widgetConfig = useMemo(
    () => ({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: allowSymbolChange,
      hide_side_toolbar: hideSideToolbar,
      withdateranges: withDateRanges,
      save_image: saveImage,
      studies,
      container_id: containerId,
      toolbar_bg: "#0b0b0b",
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      backgroundColor: "#0b0b0b",
      gridColor: "rgba(255,205,5,0.04)",
      support_host: "https://www.tradingview.com",
    }),
    [
      allowSymbolChange,
      containerId,
      hideSideToolbar,
      interval,
      saveImage,
      studies,
      symbol,
      withDateRanges,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setHasError(false);

    const init = async () => {
      try {
        await loadTradingViewScript();
        if (cancelled || !window.TradingView?.widget || !hostRef.current) {
          return;
        }

        hostRef.current.innerHTML = `<div id="${containerId}" style="height:100%;width:100%"></div>`;
        new window.TradingView.widget(widgetConfig);
      } catch (error) {
        console.error("TradingView widget init failed", error);
        if (!cancelled) {
          setHasError(true);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
      }
    };
  }, [containerId, widgetConfig]);

  return (
    <div className={`relative w-full ${className}`} style={{ height, minHeight: 600 }}>
      <div ref={hostRef} className="h-full w-full" />
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90">
          <div className="rounded-xl border border-border/50 bg-card/90 px-4 py-3 text-sm text-muted-foreground">
            Live chart unavailable right now.
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TradingViewAdvancedIframe;
