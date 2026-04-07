import { useState, useEffect, useRef } from "react";
import { TrendingUp, BarChart3, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";

const TradingViewChart = ({ symbol = "FX:EURUSD", interval = "60" }: { symbol?: string; interval?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      backgroundColor: "#ffffff",
      gridColor: "rgba(0, 0, 0, 0.06)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: true,
      details: true,
      hotlist: true,
      studies: ["STD;RSI", "STD;MACD"],
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650",
      support_host: "https://www.tradingview.com",
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      drawings_access: { type: "all" },
    });
    containerRef.current.appendChild(script);
  }, [symbol, interval]);

  return (
    <div className="tradingview-widget-container h-full" ref={containerRef} />
  );
};

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-[hsl(45,100%,50%)]" />
              <span className="font-heading text-lg font-bold text-foreground">
                Elite <span className="text-[hsl(45,100%,50%)]">Live Trading Room</span>
              </span>
            </Link>
            <Badge variant="secondary" className="text-xs">Dashboard</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link to="/chatroom">
                <MessageSquare className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Chatroom</span>
              </Link>
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              DH
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* Chart */}
        <div className="flex flex-col rounded-lg border border-border bg-card p-4" style={{ height: 'calc(100vh - 5.5rem)' }}>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-sm font-semibold text-foreground">EUR/USD — Live Chart</h3>
          </div>
          <div className="flex-1 min-h-0">
            <TradingViewChart />
          </div>
        </div>

        {/* News Flow / Squawk / Calendar / Tools — full width */}
        <NewsFlowWidget />
      </div>
    </div>
  );
};

export default Dashboard;
