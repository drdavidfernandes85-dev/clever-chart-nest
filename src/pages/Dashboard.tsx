import { BarChart3, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import EconomicCalendarWidget from "@/components/dashboard/EconomicCalendarWidget";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import TradingViewMiniChart from "@/components/dashboard/TradingViewMiniChart";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import CommunityNest from "@/components/dashboard/CommunityNest";
import UpcomingSessions from "@/components/dashboard/UpcomingSessions";
import infinoxLogo from "@/assets/infinox-logo-white.png";

const Dashboard = () => {
  return (
    <div className="min-h-screen">
      {/* Top header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/85 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img src={infinoxLogo} alt="INFINOX" className="h-5" />
              <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
              <span className="hidden sm:inline font-proxima text-sm font-semibold text-foreground">
                Elite <span className="text-primary">Live Trading Room</span>
              </span>
            </Link>
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wider rounded-full border-primary/30 bg-primary/10 text-primary"
            >
              Clever Chart Nest
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/live-chart">
                <BarChart3 className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Live Chart</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/chatroom">
                <MessageSquare className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Chatroom</span>
              </Link>
            </Button>
            <NotificationsBell />
            <Link
              to="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              <User className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Live ticker */}
      <ForexTickerBar />

      {/* Title strip */}
      <div className="px-4 pt-4">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-proxima text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Trading <span className="text-primary">Command Center</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Bloomberg-style multi-panel terminal · Live markets · Community Nest
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(145_65%_50%)] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(145_65%_50%)]" />
            </span>
            <span className="text-xs font-mono text-foreground">MARKETS OPEN</span>
          </div>
        </div>
      </div>

      {/* Bloomberg-style modular grid */}
      <div className="px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Center column — chart + lower row */}
          <div className="space-y-4 min-w-0">
            <TradingViewMiniChart symbol="FX:EURUSD" interval="60" height={420} />

            {/* Lower row: Sessions + News */}
            <div className="grid gap-4 md:grid-cols-2">
              <UpcomingSessions />
              <NewsFlowWidget />
            </div>

            <EconomicCalendarWidget />
          </div>

          {/* Right sidebar — Community Nest */}
          <aside className="space-y-4">
            <CommunityNest />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
