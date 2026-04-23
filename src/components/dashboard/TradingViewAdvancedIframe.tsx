import { useMemo } from "react";

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

const TradingViewAdvancedIframe = ({
  symbol = "FX:EURUSD",
  interval = "1",
  height = "100%",
  allowSymbolChange = false,
  hideSideToolbar = true,
  withDateRanges = false,
  saveImage = false,
  calendar = false,
  details = false,
  hotlist = false,
  studies = [],
  className = "",
}: Props) => {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol,
      interval,
      theme: "dark",
      style: "1",
      locale: "en",
      timezone: "Etc/UTC",
      studies: JSON.stringify(studies),
      withdateranges: withDateRanges ? "1" : "0",
      hide_top_toolbar: "0",
      hide_legend: "0",
      hide_side_toolbar: hideSideToolbar ? "1" : "0",
      allow_symbol_change: allowSymbolChange ? "1" : "0",
      saveimage: saveImage ? "1" : "0",
      calendar: calendar ? "1" : "0",
      details: details ? "1" : "0",
      hotlist: hotlist ? "1" : "0",
      toolbarbg: "#0b0b0b",
      backgroundColor: "#0b0b0b",
      gridColor: "rgba(255,205,5,0.05)",
      watchlist: "[]",
    });

    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [
    allowSymbolChange,
    calendar,
    details,
    hideSideToolbar,
    hotlist,
    interval,
    saveImage,
    studies,
    symbol,
    withDateRanges,
  ]);

  return (
    <iframe
      key={`${symbol}-${interval}-${hideSideToolbar ? "compact" : "full"}`}
      title={`TradingView chart for ${symbol}`}
      src={src}
      className={`w-full border-0 bg-background ${className}`}
      style={{ height, minHeight: 600 }}
      loading="eager"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
};

export default TradingViewAdvancedIframe;
