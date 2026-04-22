import { BarChart3, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import WebinarWidget from "@/components/dashboard/WebinarWidget";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import EconomicCalendarWidget from "@/components/dashboard/EconomicCalendarWidget";
import DailyBriefing from "@/components/ai/DailyBriefing";
import SentimentGauge from "@/components/ai/SentimentGauge";
import AICopilot from "@/components/ai/AICopilot";
import infinoxLogo from "@/assets/infinox-logo-white.png";

const Dashboard = () => {
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
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider rounded-full">Dashboard</Badge>
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
            <Link to="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/80 transition-colors">
              <User className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <ForexTickerBar />

      {/* Welcome strip */}
      <div className="px-4 pt-6">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
              Trading <span className="text-gradient">Command Center</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Live markets, your performance, and the room — all in one place.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-foreground">MARKETS OPEN</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Webinar */}
        <div>
          <WebinarWidget />
        </div>

        {/* News + Calendar */}
        <div className="grid gap-4 lg:grid-cols-2">
          <EconomicCalendarWidget />
          <NewsFlowWidget />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
