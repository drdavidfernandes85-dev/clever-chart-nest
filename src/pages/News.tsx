import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Newspaper, CalendarDays, BarChart3, MessageSquare } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import EconomicCalendarWidget from "@/components/dashboard/EconomicCalendarWidget";
import UpcomingSessions from "@/components/dashboard/UpcomingSessions";
import NotificationsBell from "@/components/notifications/NotificationsBell";

import AccountSnapshot from "@/components/dashboard/AccountSnapshot";
import SEO from "@/components/SEO";
import { useLanguage } from "@/i18n/LanguageContext";

const News = () => {
  const [tickerOpen, setTickerOpen] = useState(false);
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Default to "calendar" tab when arriving via /calendar route
  const initialTab = location.pathname.startsWith("/calendar") ? "calendar" : "news";
  const [tab, setTab] = useState<"news" | "calendar">(initialTab);

  const handleTabChange = (v: string) => {
    const next = (v as "news" | "calendar") ?? "news";
    setTab(next);
    // Keep URL in sync (without full navigation) for shareability
    const targetPath = next === "calendar" ? "/calendar" : "/news";
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  };

  const isCalendar = tab === "calendar";

  return (
    <>
      <SEO
        title={isCalendar ? "Calendario | IX Live Trading Room" : "Noticias | IX Live Trading Room"}
        description="Flujo de noticias en tiempo real y calendario económico para traders profesionales."
        canonical={`https://elitelivetradingroom.com${isCalendar ? "/calendar" : "/news"}`}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-2xl">
          <div className="flex h-16 items-center gap-4 px-6 lg:px-10">
            <h1 className="hidden xl:flex items-center gap-2 font-proxima text-sm font-semibold text-foreground shrink-0">
              {isCalendar ? (
                <CalendarDays className="h-4 w-4 text-primary" />
              ) : (
                <Newspaper className="h-4 w-4 text-primary" />
              )}
              <span className="text-primary">
                {isCalendar ? t("page.calendar") : t("page.news")}
              </span>
            </h1>

            <div className="relative flex-1 max-w-lg ml-auto xl:ml-8">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={isCalendar ? t("page.searchEvent") : t("page.searchNews")}
                className="h-9 pl-10 bg-card/60 border-border/40 text-xs placeholder:text-muted-foreground/70 focus-visible:ring-primary/40 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto xl:ml-0">
              <AccountSnapshot />
              <button
                onClick={() => setTickerOpen((v) => !v)}
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                {t("page.markets")}
                {tickerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-muted-foreground hover:text-primary">
                <Link to="/live-chart" aria-label="Live chart"><BarChart3 className="h-4 w-4" /></Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-muted-foreground hover:text-primary">
                <Link to="/chatroom" aria-label="Chatroom"><MessageSquare className="h-4 w-4" /></Link>
              </Button>
              <NotificationsBell />
              <Link to="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/85 transition-colors" aria-label="Profile">A</Link>
            </div>
          </div>

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

        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto max-w-6xl"
          >
            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="mb-6 grid w-full max-w-sm grid-cols-2 rounded-xl bg-card/60 border border-border/40">
                <TabsTrigger value="news" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Newspaper className="h-3.5 w-3.5" />
                  {t("page.news")}
                </TabsTrigger>
                <TabsTrigger value="calendar" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t("page.calendar")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="news" className="mt-0">
                <div className="mx-auto max-w-4xl">
                  <NewsFlowWidget />
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="grid gap-8 lg:grid-cols-2">
                  <EconomicCalendarWidget />
                  <UpcomingSessions />
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default News;
