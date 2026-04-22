import { useEffect, useState } from "react";
import { BarChart3, MessageSquare, User, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import EconomicCalendarWidget from "@/components/dashboard/EconomicCalendarWidget";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import KpiStrip from "@/components/dashboard/KpiStrip";

import NotificationsBell from "@/components/notifications/NotificationsBell";
import CommunityNest from "@/components/dashboard/CommunityNest";
import UpcomingSessions from "@/components/dashboard/UpcomingSessions";
import infinoxLogo from "@/assets/infinox-logo-white.png";

/** Compact Bloomberg-style market sessions clock (UTC). */
const MARKET_SESSIONS = [
  { name: "Sídney", flag: "🇦🇺", openUTC: 22, closeUTC: 7 },
  { name: "Tokio", flag: "🇯🇵", openUTC: 0, closeUTC: 9 },
  { name: "Londres", flag: "🇬🇧", openUTC: 8, closeUTC: 16.5 },
  { name: "Nueva York", flag: "🇺🇸", openUTC: 13.5, closeUTC: 21 },
];

const isOpen = (o: number, c: number, h: number) =>
  o < c ? h >= o && h < c : h >= o || h < c;

const MarketSessionsClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const h = now.getUTCHours() + now.getUTCMinutes() / 60;
  const utc = now.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  return (
    <div className="ix-panel overflow-hidden">
      <div className="ix-panel-header flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-primary" />
          <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
            Sesiones del mercado
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-primary">UTC {utc}</span>
      </div>
      <ul className="divide-y divide-primary/10">
        {MARKET_SESSIONS.map((s) => {
          const open = isOpen(s.openUTC, s.closeUTC, h);
          return (
            <li key={s.name} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{s.flag}</span>
                <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`relative flex h-1.5 w-1.5 ${open ? "" : "opacity-40"}`}
                  aria-hidden
                >
                  {open && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  )}
                  <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                      open ? "bg-primary" : "bg-muted-foreground"
                    }`}
                  />
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${
                    open ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {open ? "Abierto" : "Cerrado"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const Dashboard = () => {
  return (
    <div className="min-h-screen">
      {/* Top header */}
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-background/85 backdrop-blur-2xl">
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
              className="text-[10px] uppercase tracking-wider rounded-full border-primary/40 bg-primary/15 text-primary"
            >
              Clever Chart Nest
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
              <Link to="/live-chart">
                <BarChart3 className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Gráfico en vivo</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
              <Link to="/chatroom">
                <MessageSquare className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Chat</span>
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
              Centro de <span className="text-primary">Comando de Trading</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Terminal modular estilo Bloomberg · Mercados en vivo · Community Nest
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-mono uppercase tracking-wider text-primary">Mercados abiertos</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="px-4 pt-4">
        <KpiStrip />
      </div>

      {/* Bloomberg-style dense modular grid */}
      <div className="px-4 py-4">
        <div className="grid gap-3 lg:grid-cols-[260px_1fr_320px]">
          {/* Left rail — sessions clock + sessions list */}
          <aside className="space-y-3 min-w-0">
            <MarketSessionsClock />
            <UpcomingSessions />
          </aside>

          {/* Center — news flow + economic calendar stacked */}
          <div className="space-y-3 min-w-0">
            <NewsFlowWidget />
            <EconomicCalendarWidget />
          </div>

          {/* Right sidebar — Community Nest */}
          <aside className="min-w-0">
            <CommunityNest />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
