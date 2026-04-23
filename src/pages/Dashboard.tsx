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
  const { account } = useMTAccount();
  const isConnected = !!account && account.status === "connected";

  // Persist rail state
  useEffect(() => {
    const saved = localStorage.getItem("eltr.rail.open");
    if (saved !== null) setRailOpen(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("eltr.rail.open", railOpen ? "1" : "0");
  }, [railOpen]);

  // Lock body scroll only when an actual overlay is open on mobile.
  // The desktop Quick Trade panel is inline, so `tradeOpen` alone must
  // NOT lock scroll on desktop — only when the mobile bottom sheet is
  // visible (viewport < lg / 1024px).
  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
    const lock = mobileNavOpen || (tradeOpen && isMobile);
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

              {/* Connected via EA — compact status pill */}
              {isConnected && (
                <span
                  className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[hsl(145_65%_50%)]/30 bg-[hsl(145_65%_50%)]/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[hsl(145_65%_50%)]"
                  title={`MT${account?.platform === "mt4" ? "4" : "5"} #${account?.login} • Connected via EA`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(145_65%_50%)] opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(145_65%_50%)]" />
                  </span>
                  EA · #{account?.login}
                </span>
              )}

              {/* Launch Advanced Trading Terminal — secondary header CTA */}
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden lg:inline-flex h-9 px-3 border-primary/40 bg-primary/5 text-primary hover:bg-primary/15 hover:text-primary font-bold text-xs uppercase tracking-wider rounded-lg"
              >
                <Link to="/live-chart" className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Terminal
                </Link>
              </Button>

              {/* TRADE — primary header CTA, prominent */}
              <Button
                onClick={() => openTrade()}
                size="sm"
                className="hidden sm:inline-flex h-10 px-4 bg-primary text-primary-foreground hover:bg-primary font-bold text-xs uppercase tracking-[0.18em] rounded-lg shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.7)] hover:shadow-[0_14px_40px_-10px_hsl(48_100%_51%/0.9)] hover:-translate-y-px transition-all"
              >
                <Zap className="h-4 w-4 mr-1.5" />
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
        <main className="flex-1 px-3 sm:px-6 lg:px-12 py-6 sm:py-10 lg:py-12 space-y-8 sm:space-y-10 lg:space-y-12 pb-28 lg:pb-12">
          {/* 1. Top KPI row — 4 clean cards */}
          <KpiStrip />

          {/* 2. Command Center — Portfolio (hero) + Right Sidebar */}
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_336px] items-start">
            {/* Hero — Portfolio Overview with sparkline + open positions */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="min-w-0"
            >
              <PortfolioOverview />
            </motion.section>

            {/* Right narrow sidebar — Risk → Quick Trade → Watchlist */}
            <aside className="min-w-0 space-y-5 lg:sticky lg:top-20 self-start">
              <RiskMeter />
              <div className="hidden lg:block">
                <QuickTradePanel />
              </div>
              <Watchlist />
            </aside>
          </div>

          {/* 3. Bottom — Market Movers (Top Gainers / Losers / Most Active) */}
          <section>
            <MarketMovers />
          </section>

          {/* Optional community rail — toggleable, kept out of main flow */}
          <AnimatePresence initial={false}>
            {railOpen && (
              <motion.aside
                key="rail"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.3 }}
                className="hidden xl:grid gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_320px]"
              >
                <RecentActivity />
                <div className="min-w-0 space-y-6">
                  <LiveSharedSignals />
                  <CommunityNest />
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
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
