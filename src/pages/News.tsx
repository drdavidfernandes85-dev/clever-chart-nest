import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, MessageSquare } from "lucide-react";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import NotificationsBell from "@/components/notifications/NotificationsBell";

import AccountSnapshot from "@/components/dashboard/AccountSnapshot";
import SEO from "@/components/SEO";
import { useLanguage } from "@/i18n/LanguageContext";

const News = () => {
  const [tickerOpen, setTickerOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <SEO
        title="Noticias | IX Live Trading Room"
        description="Flujo de noticias en tiempo real para traders profesionales."
        canonical="https://elitelivetradingroom.com/news"
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-2xl">
          <div className="flex h-16 items-center gap-4 px-6 lg:px-10">
            <h1 className="hidden xl:flex items-center gap-2 font-proxima text-sm font-semibold text-foreground shrink-0">
              <Newspaper className="h-4 w-4 text-primary" />
              <span className="text-primary">{t("page.news")}</span>
            </h1>

            <div className="relative flex-1 max-w-lg ml-auto xl:ml-8">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t("page.searchNews")}
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
            className="mx-auto max-w-4xl"
          >
            <NewsFlowWidget />
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default News;
