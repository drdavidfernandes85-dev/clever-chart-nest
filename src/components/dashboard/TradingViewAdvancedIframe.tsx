import { useEffect, useRef } from "react";

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

/**
 * Real TradingView Advanced Chart widget — loads the official tv.js script
 * inside an isolated container. This gives us the full toolbar (timeframes,
 * indicators, drawing tools, fullscreen, compare) and live market data.
 */
const TradingViewAdvancedIframe = ({
  symbol = "FX:EURUSD",
  interval = "15",
  height = "100%",
  allowSymbolChange = true,
  hideSideToolbar = false,
  withDateRanges = true,
  saveImage = true,
  calendar = false,
  details = false,
  hotlist = false,
  studies = [],
  className = "",
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let cancelled = false;

    const init = () => {
      if (cancelled || !host) return;
      const rect = host.getBoundingClientRect();
      // Wait until the container actually has size (flex layouts can be 0 on first paint)
      if (rect.height < 50 || rect.width < 50) {
        requestAnimationFrame(init);
        return;
      }

      host.innerHTML = `
        <div class="tradingview-widget-container__widget" style="height:calc(100% - 28px);width:100%"></div>
        <div class="tradingview-widget-copyright" style="height:28px;line-height:28px;text-align:center;font-size:11px;color:#555">
          <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style="color:#FFCD05">Track all markets on TradingView</a>
        </div>
      `;

      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
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
        calendar,
        details,
        hotlist,
        studies,
        backgroundColor: "rgba(11,11,11,1)",
        gridColor: "rgba(255,205,5,0.04)",
        toolbar_bg: "#0b0b0b",
        hide_volume: false,
        support_host: "https://www.tradingview.com",
      });

      host.appendChild(script);
    };

    init();

    return () => {
      cancelled = true;
      if (host) host.innerHTML = "";
    };
  }, [
    symbol,
    interval,
    allowSymbolChange,
    hideSideToolbar,
    withDateRanges,
    saveImage,
    calendar,
    details,
    hotlist,
    JSON.stringify(studies),
  ]);

  return (
    <div
      className={`tradingview-widget-container w-full ${className}`}
      style={{ height, minHeight: 600 }}
      ref={containerRef}
    />
  );
};

export default TradingViewAdvancedIframe;
