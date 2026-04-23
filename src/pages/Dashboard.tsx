import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  MessageSquare,
  Search,
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import KpiStrip from "@/components/dashboard/KpiStrip";
import LightweightCandlestickChart from "@/components/dashboard/LightweightCandlestickChart";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import CommunityNest from "@/components/dashboard/CommunityNest";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import AccountSnapshot from "@/components/dashboard/AccountSnapshot";

const Dashboard = () => {
  const [tickerOpen, setTickerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  // Persist rail state across reloads for a "settings remembered" feel
  useEffect(() => {
    const saved = localStorage.getItem("eltr.rail.open");
    if (saved !== null) setRailOpen(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("eltr.rail.open", railOpen ? "1" : "0");
  }, [railOpen]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left rail navigation */}
      <DashboardSidebar />

      {/* Main shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header — clean: search + account + actions */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-2xl">
          <div className="flex h-16 items-center gap-4 px-6 lg:px-12">
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
              {/* Right rail toggle */}
              <button
                onClick={() => setRailOpen((v) => !v)}
                className="hidden xl:inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-expanded={railOpen}
                aria-label={railOpen ? "Hide community" : "Show community"}
                title={railOpen ? "Hide community" : "Show community"}
              >
                {railOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </button>
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
        <main className="flex-1 px-6 py-10 lg:px-12 lg:py-12 space-y-10 lg:space-y-12">
          {/* KPIs — compact, 4 cards */}
          <KpiStrip />

          {/* Hero grid: dominant chart + collapsible community rail */}
          <div
            className={`grid gap-10 lg:gap-12 ${
              railOpen ? "xl:grid-cols-[minmax(0,1fr)_268px]" : "xl:grid-cols-1"
            }`}
          >
            {/* HERO CHART — dominant, ~70% of viewport */}
            <div className="min-w-0">
              <LightweightCandlestickChart symbol="EUR/USD" height={720} />
            </div>

            {/* Right community rail — collapsible */}
            <AnimatePresence initial={false}>
              {railOpen && (
                <motion.aside
                  key="rail"
                  initial={{ opacity: 0, x: 16, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: "auto" }}
                  exit={{ opacity: 0, x: 16, width: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="min-w-0 overflow-hidden"
                >
                  <div className="xl:sticky xl:top-24">
                    <CommunityNest />
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
