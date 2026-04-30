import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Hash,
  MessageSquare,
  Radio,
  Sparkles,
  ArrowRight,
  Activity,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import OnlineTraders from "@/components/chatroom/OnlineTraders";
import LiveSharedSignals from "@/components/dashboard/LiveSharedSignals";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface Channel {
  id: string;
  name: string;
  category: string;
}

const formatChannelName = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const Community = () => {
  const { t, locale } = useLanguage();
  const [onlineCount, setOnlineCount] = useState(184);
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("channels")
        .select("id, name, category")
        .order("created_at");
      if (!cancelled && data) setChannels(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Simulated live online counter (same heuristic used elsewhere in the app).
  useEffect(() => {
    const tick = setInterval(() => {
      setOnlineCount((n) =>
        Math.max(120, Math.min(420, n + Math.floor((Math.random() - 0.5) * 6))),
      );
    }, 5000);
    return () => clearInterval(tick);
  }, []);

  const groupedChannels = useMemo(
    () =>
      channels.reduce<Record<string, Channel[]>>((acc, ch) => {
        (acc[ch.category] ??= []).push(ch);
        return acc;
      }, {}),
    [channels],
  );

  const seoLang =
    locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: t("community.seo.title"),
    description: t("community.seo.desc"),
    inLanguage: seoLang,
    url: "https://elitelivetradingroom.com/community",
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <SEO
        title={t("community.seo.title")}
        description={t("community.seo.desc")}
        keywords={t("community.seo.keywords")}
        canonical="https://elitelivetradingroom.com/community"
        jsonLd={jsonLd}
      />

      {/* Ambient fiery glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[hsl(45,100%,50%)]/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[hsl(15,90%,55%)]/10 blur-[100px]" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/dashboard"
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            ← {t("nav.dashboard")}
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-8 overflow-hidden rounded-3xl border border-[hsl(45,100%,50%)]/30 bg-gradient-to-br from-card/80 via-card/60 to-background/40 p-6 backdrop-blur-xl shadow-[0_0_60px_-15px_hsl(45,100%,50%/0.35)] sm:p-10"
        >
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[hsl(45,100%,50%)]/15 blur-3xl" />
          </div>

          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[hsl(45,100%,50%)]/40 bg-[hsl(45,100%,50%)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(45,100%,55%)]">
              <Sparkles className="h-3 w-3" />
              {t("community.eyebrow")}
            </div>
            <h1 className="font-heading text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t("community.h1")}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {t("community.subheadline")}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2.5 rounded-2xl border border-[hsl(145,65%,45%)]/30 bg-[hsl(145,65%,45%)]/10 px-4 py-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-[hsl(145,65%,50%)] opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[hsl(145,65%,50%)]" />
                </span>
                <span className="font-mono text-base font-bold tabular-nums text-foreground">
                  {onlineCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("community.online")}
                </span>
              </div>

              <Button
                asChild
                className="rounded-2xl bg-[hsl(45,100%,50%)] font-bold text-black shadow-[0_10px_30px_-10px_hsl(45,100%,50%/0.7)] hover:bg-[hsl(45,100%,55%)]"
              >
                <Link to="/chatroom">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t("community.openChat")}
                </Link>
              </Button>
            </div>
          </div>
        </motion.header>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Chat rooms */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="rounded-3xl border border-border/50 bg-card/70 p-5 backdrop-blur-xl sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(45,100%,50%)]/15 text-[hsl(45,100%,55%)]">
                    <Hash className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-heading text-lg font-bold text-foreground">
                      {t("community.rooms.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t("community.rooms.subtitle")}
                    </p>
                  </div>
                </div>
                <Link
                  to="/chatroom"
                  className="hidden text-xs font-semibold uppercase tracking-widest text-[hsl(45,100%,55%)] hover:underline sm:inline"
                >
                  {t("community.viewAll")} →
                </Link>
              </div>

              {Object.keys(groupedChannels).length === 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {["general", "market_discussion", "webinars", "trades_room"].map(
                    (n) => (
                      <Link
                        key={n}
                        to="/chatroom"
                        className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/40 p-4 transition-all hover:border-[hsl(45,100%,50%)]/40 hover:bg-[hsl(45,100%,50%)]/5"
                      >
                        <Hash className="h-4 w-4 shrink-0 text-[hsl(45,100%,55%)]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {formatChannelName(n)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {Math.floor(20 + Math.random() * 60)}{" "}
                            {t("community.rooms.members")}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ),
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(groupedChannels).map(([category, list]) => (
                    <div key={category}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        {category}
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {list.map((ch) => (
                          <Link
                            key={ch.id}
                            to="/chatroom"
                            className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-background/40 p-3.5 transition-all hover:border-[hsl(45,100%,50%)]/40 hover:bg-[hsl(45,100%,50%)]/5"
                          >
                            <Hash className="h-4 w-4 shrink-0 text-[hsl(45,100%,55%)]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {formatChannelName(ch.name)}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(45,100%,55%)]" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>

            {/* Shared Market Ideas */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="overflow-hidden rounded-3xl border border-[hsl(45,100%,50%)]/30 bg-card/70 backdrop-blur-xl shadow-[0_10px_40px_-15px_hsl(45,100%,50%/0.35)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-[hsl(45,100%,50%)]/5 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Radio className="h-4 w-4 animate-pulse text-[hsl(45,100%,55%)]" />
                  <div>
                    <h2 className="font-heading text-base font-bold text-foreground">
                      {t("community.ideas.title")}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {t("community.ideas.subtitle")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-2 sm:p-3">
                <LiveSharedSignals />
              </div>
            </motion.section>

            {/* Activity */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="rounded-3xl border border-border/50 bg-card/70 p-5 backdrop-blur-xl sm:p-6"
            >
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(45,100%,50%)]/15 text-[hsl(45,100%,55%)]">
                  <Activity className="h-4 w-4" />
                </div>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  {t("community.activity.title")}
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border/40 bg-background/40 p-4 text-center">
                  <Flame className="mx-auto mb-1.5 h-4 w-4 text-[hsl(45,100%,55%)]" />
                  <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                    {onlineCount}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Online
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/40 p-4 text-center">
                  <MessageSquare className="mx-auto mb-1.5 h-4 w-4 text-[hsl(45,100%,55%)]" />
                  <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                    {Math.floor(onlineCount * 3.2)}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Messages 24h
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/40 p-4 text-center">
                  <Sparkles className="mx-auto mb-1.5 h-4 w-4 text-[hsl(45,100%,55%)]" />
                  <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                    {Math.floor(onlineCount / 6)}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Ideas 24h
                  </p>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Right column — Online traders */}
          <motion.aside
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-3xl border border-border/50 bg-card/70 p-4 backdrop-blur-xl sm:p-5 lg:sticky lg:top-6 lg:self-start"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(45,100%,50%)]/15 text-[hsl(45,100%,55%)]">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-heading text-base font-bold text-foreground">
                  {t("community.traders.title")}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {t("community.traders.subtitle")}
                </p>
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <OnlineTraders />
            </div>
          </motion.aside>
        </div>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-col items-center gap-4 rounded-3xl border-2 border-[hsl(45,100%,50%)]/40 bg-gradient-to-br from-[hsl(45,100%,50%)]/[0.08] to-transparent p-6 text-center shadow-[0_0_40px_hsl(45,100%,50%/0.18)] sm:p-8"
        >
          <h3 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {t("community.cta.join")}
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            {t("community.cta.desc")}
          </p>
          <Button
            asChild
            size="lg"
            className="rounded-2xl bg-[hsl(45,100%,50%)] font-bold text-black shadow-[0_10px_30px_-10px_hsl(45,100%,50%/0.7)] hover:bg-[hsl(45,100%,55%)]"
          >
            <Link to="/chatroom">
              <MessageSquare className="mr-2 h-4 w-4" />
              {t("community.openChat")}
            </Link>
          </Button>
        </motion.section>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {t("community.disclaimer")}
        </p>
      </div>
    </main>
  );
};

export default Community;
