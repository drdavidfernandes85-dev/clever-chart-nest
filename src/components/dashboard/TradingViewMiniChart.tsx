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
      backgroundColor: theme === "dark" ? "rgba(15,15,15,0)" : "rgba(255,255,255,0)",
      gridColor: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      details: false,
      hotlist: false,
      withdateranges: true,
      hide_side_toolbar: true,
      support_host: "https://www.tradingview.com",
    });
    ref.current.appendChild(script);
  }, [symbol, interval, theme]);

  return (
    <Card className="card-glass p-4 overflow-hidden">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-foreground">Live Chart</h3>
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">TradingView</span>
      </div>
      <div ref={ref} style={{ height }} className="w-full tradingview-widget-container" />
    </Card>
  );
};

export default TradingViewMiniChart;
