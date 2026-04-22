import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  symbol?: string;
  interval?: string;
  height?: number;
}

const TradingViewMiniChart = ({ symbol = "FX:EURUSD", interval = "60", height = 380 }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: theme === "dark" ? "dark" : "light",
      style: "1",
      locale: "en",
      backgroundColor: theme === "dark" ? "#1E1E1E" : "#FFFFFF",
      gridColor: theme === "dark" ? "rgba(255,205,5,0.08)" : "rgba(0,0,0,0.04)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      details: false,
      hotlist: false,
      withdateranges: true,
      hide_side_toolbar: false,
      studies: [
        "MASimple@tv-basicstudies",
        "MAExp@tv-basicstudies",
        "RSI@tv-basicstudies",
        "MACD@tv-basicstudies",
        "BB@tv-basicstudies",
      ],
      overrides: {
        "mainSeriesProperties.candleStyle.upColor": "#FFCD05",
        "mainSeriesProperties.candleStyle.downColor": "#FF4D6B",
        "mainSeriesProperties.candleStyle.borderUpColor": "#FFCD05",
        "mainSeriesProperties.candleStyle.borderDownColor": "#FF4D6B",
        "mainSeriesProperties.candleStyle.wickUpColor": "#FFCD05",
        "mainSeriesProperties.candleStyle.wickDownColor": "#FF4D6B",
        "paneProperties.background": theme === "dark" ? "#1E1E1E" : "#FFFFFF",
        "paneProperties.backgroundType": "solid",
        "paneProperties.vertGridProperties.color": "rgba(255, 205, 5, 0.08)",
        "paneProperties.horzGridProperties.color": "rgba(255, 205, 5, 0.08)",
      },
      support_host: "https://www.tradingview.com",
    });
    ref.current.appendChild(script);
  }, [symbol, interval, theme]);

  return (
    <Card className="card-glass p-4 overflow-hidden relative">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-proxima text-sm font-semibold text-foreground">Live Chart</h3>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
            Clever Chart Nest
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          TradingView · Live
        </span>
      </div>
      <div ref={ref} style={{ height }} className="w-full tradingview-widget-container" />
    </Card>
  );
};

export default TradingViewMiniChart;
