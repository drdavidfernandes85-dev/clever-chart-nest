import { useRef, useEffect } from "react";
import { BarChart3, MessageSquare, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import TradeJournal from "@/components/dashboard/TradeJournal";
import PerformanceAnalytics from "@/components/dashboard/PerformanceAnalytics";
import AICopilot from "@/components/ai/AICopilot";
import infinoxLogo from "@/assets/infinox-logo-white.png";

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
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "hsl(0, 0%, 4%)",
      gridColor: "rgba(255, 255, 255, 0.03)",
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

  return <div className="tradingview-widget-container h-full" ref={containerRef} />;
};

const LiveChart = () => {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img src={infinoxLogo} alt="INFINOX" className="h-5" />
              <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
              <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
                Elite <span className="text-primary">Live Trading Room</span>
              </span>
            </Link>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider rounded-full">Live Chart</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/chatroom">
                <MessageSquare className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Chatroom</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-border/30 bg-card p-4 flex flex-col h-[calc(100vh-5.5rem)]">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-sm font-semibold text-foreground">EUR/USD — Live Chart</h3>
          </div>
          <div className="flex-1 min-h-0">
            <TradingViewChart />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PerformanceAnalytics />
          <TradeJournal />
        </div>
      </div>
    </div>
  );
};

export default LiveChart;
