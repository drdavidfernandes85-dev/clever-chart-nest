import { BarChart3, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import WebinarWidget from "@/components/dashboard/WebinarWidget";
import infinoxLogo from "@/assets/infinox-logo-white.png";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-2xl shadow-lg shadow-background/50">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img src={infinoxLogo} alt="INFINOX" className="h-5" />
              <span className="hidden sm:inline text-xs text-muted-foreground/40">|</span>
              <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground tracking-tight">
                Elite <span className="text-primary">Live Trading Room</span>
              </span>
            </Link>
            <Badge variant="secondary" className="text-xs rounded-lg">Dashboard</Badge>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
              DH
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* Webinar — Live & Recordings */}
        <WebinarWidget />

        {/* News Flow / Squawk / Calendar / Tools — full width */}
        <NewsFlowWidget />
      </div>
    </div>
  );
};

export default Dashboard;
