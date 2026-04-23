import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, MessageSquare, Search, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import EconomicCalendarWidget from "@/components/dashboard/EconomicCalendarWidget";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import KpiStrip from "@/components/dashboard/KpiStrip";
import LightweightCandlestickChart from "@/components/dashboard/LightweightCandlestickChart";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import CommunityNest from "@/components/dashboard/CommunityNest";
import UpcomingSessions from "@/components/dashboard/UpcomingSessions";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import AccountSnapshot from "@/components/dashboard/AccountSnapshot";

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
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-primary" />
          <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
            Sesiones del mercado
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-primary">UTC {utc}</span>
      </div>
      <ul className="divide-y divide-border/30">
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
  const [tickerOpen, setTickerOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left rail navigation */}
      <DashboardSidebar />

      {/* Main shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header — clean: search + account + actions */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-2xl">
          <div className="flex h-16 items-center gap-4 px-6 lg:px-10">
            <h1 className="hidden xl:block font-proxima text-sm font-semibold text-foreground shrink-0">
              Centro de <span className="text-primary">Comando</span>
            </h1>

            {/* Global search */}
            <div className="relative flex-1 max-w-lg ml-auto xl:ml-8">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar instrumento, señal, miembro…"
                className="h-9 pl-10 bg-card/60 border-border/40 text-xs placeholder:text-muted-foreground/70 focus-visible:ring-primary/40 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto xl:ml-0">
              <AccountSnapshot />
              <button
                onClick={() => setTickerOpen((v) => !v)}
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                aria-expanded={tickerOpen}
                aria-label="Toggle market ticker"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Mercados
                {tickerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden sm:inline-flex text-muted-foreground hover:text-primary"
              >
                <Link to="/live-chart" aria-label="Live chart">
                  <BarChart3 className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden sm:inline-flex text-muted-foreground hover:text-primary"
              >
                <Link to="/chatroom" aria-label="Chatroom">
                  <MessageSquare className="h-4 w-4" />
                </Link>
              </Button>
              <NotificationsBell />
              <Link
                to="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/85 transition-colors"
                aria-label="Profile"
              >
                A
              </Link>
            </div>
          </div>

          {/* Collapsible live ticker */}
          <AnimatePresence initial={false}>
            {tickerOpen && (
              <motion.div
                key="ticker"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <ForexTickerBar />
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Page body — generous spacing, hero chart layout */}
        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10 space-y-8 lg:space-y-10">
          {/* KPIs — 4 max, already responsive */}
          <KpiStrip />

          {/* Hero grid: dominant chart + narrow community rail */}
          <div className="grid gap-8 lg:gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
            {/* Chart + supporting widgets */}
            <div className="space-y-8 lg:space-y-10 min-w-0">
              {/* HERO CHART — visual centerpiece */}
              <LightweightCandlestickChart symbol="EUR/USD" height={620} />

              {/* Secondary row: news + calendar */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
                className="grid gap-6 md:grid-cols-2"
              >
                <NewsFlowWidget />
                <EconomicCalendarWidget />
              </motion.div>

              {/* Tertiary row: sessions clock + upcoming */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
                className="grid gap-6 md:grid-cols-2"
              >
                <MarketSessionsClock />
                <UpcomingSessions />
              </motion.div>
            </div>

            {/* Narrow right community rail (280px) */}
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="min-w-0"
            >
              <div className="xl:sticky xl:top-24">
                <CommunityNest />
              </div>
            </motion.aside>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
