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
  ArrowUpRight,
  Zap,
  X,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import KpiStrip from "@/components/dashboard/KpiStrip";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import CommunityNest from "@/components/dashboard/CommunityNest";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import AccountSnapshot from "@/components/dashboard/AccountSnapshot";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import Watchlist from "@/components/dashboard/Watchlist";
import LiveSharedSignals from "@/components/dashboard/LiveSharedSignals";
import MarketMovers from "@/components/dashboard/MarketMovers";
import QuickTradePanel from "@/components/dashboard/QuickTradePanel";
import RiskMeter from "@/components/dashboard/RiskMeter";
import RecentActivity from "@/components/dashboard/RecentActivity";
import MobileSidebarDrawer from "@/components/dashboard/MobileSidebarDrawer";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { useMTAccount } from "@/hooks/useMTAccount";

const Dashboard = () => {
  const [tickerOpen, setTickerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { open: tradeOpen, openTrade, close: closeTrade } = useQuickTrade();

  // Persist rail state
  useEffect(() => {
    const saved = localStorage.getItem("eltr.rail.open");
    if (saved !== null) setRailOpen(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("eltr.rail.open", railOpen ? "1" : "0");
  }, [railOpen]);

  // Lock body scroll when bottom sheet / drawer is open
  useEffect(() => {
    const lock = tradeOpen || mobileNavOpen;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [tradeOpen, mobileNavOpen]);

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />
      <MobileSidebarDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-2xl">
          <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6 lg:px-12">
            {/* Hamburger — mobile/tablet */}
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h1 className="hidden xl:block font-proxima text-sm font-semibold text-foreground shrink-0">
              Centro de <span className="text-primary">Comando</span>
            </h1>

            {/* Global search */}
            <div className="relative flex-1 max-w-lg ml-auto xl:ml-8 min-w-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar…"
                className="h-9 pl-10 bg-card/60 border-border/40 text-xs placeholder:text-muted-foreground/70 focus-visible:ring-primary/40 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1 sm:gap-2 ml-auto xl:ml-0 shrink-0">
              <div className="hidden sm:block">
                <AccountSnapshot />
              </div>

              {/* Trade button — desktop */}
              <Button
                onClick={() => openTrade()}
                size="sm"
                className="hidden sm:inline-flex h-9 px-3 bg-primary text-primary-foreground hover:bg-primary font-bold text-xs uppercase tracking-wider rounded-lg shadow-[0_8px_25px_-10px_hsl(48_100%_51%/0.6)] hover:shadow-[0_12px_35px_-10px_hsl(48_100%_51%/0.85)] transition-all"
              >
                <Zap className="h-3.5 w-3.5 mr-1" />
                Trade
              </Button>

              <button
                onClick={() => setTickerOpen((v) => !v)}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
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
                className="hidden md:inline-flex text-muted-foreground hover:text-primary"
              >
                <Link to="/live-chart" aria-label="Live chart">
                  <BarChart3 className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden md:inline-flex text-muted-foreground hover:text-primary"
              >
                <Link to="/chatroom" aria-label="Chatroom">
                  <MessageSquare className="h-4 w-4" />
                </Link>
              </Button>
              <NotificationsBell />
              <button
                onClick={() => setRailOpen((v) => !v)}
                className="hidden xl:inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-expanded={railOpen}
                aria-label={railOpen ? "Hide community" : "Show community"}
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

        {/* Page body */}
        <main className="flex-1 px-3 sm:px-6 lg:px-12 py-6 sm:py-10 lg:py-12 space-y-6 sm:space-y-10 lg:space-y-12 pb-28 lg:pb-12">
          <KpiStrip />

          <div
            className={`grid gap-6 sm:gap-8 lg:gap-10 ${
              railOpen ? "xl:grid-cols-[minmax(0,1fr)_268px]" : "xl:grid-cols-1"
            }`}
          >
            <div className="min-w-0 space-y-6 sm:space-y-8 lg:space-y-10">
              {/* Hero CTA */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="group relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/[0.06] to-transparent p-5 sm:p-7 transition-all hover:border-primary/60"
                style={{
                  boxShadow:
                    "0 20px 60px -25px hsl(48 100% 51% / 0.35), inset 0 1px 0 hsl(48 100% 51% / 0.15)",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(700px circle at 0% 50%, hsl(48 100% 51% / 0.18), transparent 60%), radial-gradient(500px circle at 100% 100%, hsl(48 100% 51% / 0.08), transparent 60%)",
                  }}
                />
                <div
                  className="pointer-events-none absolute -inset-x-20 -top-px h-px opacity-60"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(48 100% 51% / 0.8), transparent)",
                  }}
                />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(48_100%_51%)]" />
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary font-bold">
                        Markets are live
                      </span>
                    </div>
                    <h2 className="font-heading text-xl sm:text-2xl lg:text-[26px] font-bold text-foreground leading-tight">
                      Launch <span className="text-primary">Advanced Trading Terminal</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground mt-2">
                      Multi-chart <span className="text-primary/70">•</span> Indicators{" "}
                      <span className="text-primary/70">•</span> Drawing{" "}
                      <span className="text-primary/70">•</span> Shared Signals
                    </p>
                  </div>
                  <Button
                    asChild
                    size="lg"
                    className="relative bg-primary text-primary-foreground hover:bg-primary font-bold rounded-xl h-12 sm:h-14 px-5 sm:px-7 text-sm tracking-wide overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_15px_50px_-10px_hsl(48_100%_51%/0.8)] shadow-[0_10px_40px_-10px_hsl(48_100%_51%/0.6)]"
                  >
                    <Link to="/live-chart" className="flex items-center justify-center gap-2.5">
                      <BarChart3 className="h-5 w-5" />
                      Launch Terminal
                      <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  </Button>
                </div>
              </motion.div>

              {/* Risk Meter */}
              <RiskMeter />

              {/* Portfolio + Watchlist/Trade/Signals */}
              <div className="grid gap-6 sm:gap-8 lg:grid-cols-[3fr_2fr]">
                <div className="space-y-6 sm:space-y-8 min-w-0">
                  <PortfolioOverview />
                  <RecentActivity />
                </div>
                <div className="space-y-6 min-w-0">
                  <Watchlist />
                  {/* Inline Quick Trade — desktop only */}
                  <div className="hidden lg:block">
                    <QuickTradePanel />
                  </div>
                  <LiveSharedSignals />
                </div>
              </div>

              <MarketMovers />
            </div>

            {/* Right community rail */}
            <AnimatePresence initial={false}>
              {railOpen && (
                <motion.aside
                  key="rail"
                  initial={{ opacity: 0, x: 16, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: "auto" }}
                  exit={{ opacity: 0, x: 16, width: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="hidden xl:block min-w-0 overflow-hidden"
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

      {/* Floating Quick Trade FAB — mobile / tablet only */}
      <button
        onClick={() => openTrade()}
        aria-label="Open Quick Trade"
        className="lg:hidden fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_15px_40px_-8px_hsl(48_100%_51%/0.7)] hover:scale-110 active:scale-95 transition-transform"
      >
        <Zap className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" />
        </span>
      </button>

      {/* Mobile Quick Trade bottom sheet */}
      <AnimatePresence>
        {tradeOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeTrade}
              className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-card border-t border-border/40 shadow-2xl"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between bg-card/95 backdrop-blur-xl border-b border-border/30 px-4 py-3">
                <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30 absolute left-1/2 -translate-x-1/2 top-1.5" />
                <h3 className="font-heading text-sm font-bold text-foreground mt-1">
                  Quick Trade
                </h3>
                <button
                  onClick={closeTrade}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 mt-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3">
                <QuickTradePanel compact />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
