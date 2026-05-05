import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  CheckCircle2,
  Lock,
  Play,
  Trophy,
  Award,
  Medal,
  Sparkles,
  Flame,
  Star,
  ChevronRight,
  Info,
  BookOpen,
  Globe2,
  LineChart,
  Shapes,
  ShieldCheck,
  Target,
  Layers,
  Video,
} from "lucide-react";
import SEO from "@/components/SEO";
import KeywordCrossLinks from "@/components/seo/KeywordCrossLinks";
import { cn } from "@/lib/utils";
import { useModules, TOTAL_MODULES } from "@/data/educationContent";
import { useEducationProgress } from "@/hooks/useEducationProgress";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/i18n/LanguageContext";

const Education = () => {
  const { t, locale } = useLanguage();
  const MODULES = useModules();
  const { completed, loading, totalXp } = useEducationProgress(TOTAL_MODULES);
  const completedCount = completed.size;
  const percent = Math.round((completedCount * 100) / TOTAL_MODULES);

  const MILESTONES = useMemo(
    () => [
      { pct: 25, slug: "edu_milestone_bronze", label: t("edu.tier.bronze"), icon: Medal, tier: "bronze" as const, xp: 100 },
      { pct: 50, slug: "edu_milestone_silver", label: t("edu.tier.silver"), icon: Award, tier: "silver" as const, xp: 200 },
      { pct: 75, slug: "edu_milestone_gold", label: t("edu.tier.gold"), icon: Trophy, tier: "gold" as const, xp: 300 },
      { pct: 100, slug: "edu_graduate", label: t("edu.tier.graduate"), icon: GraduationCap, tier: "gold" as const, xp: 500 },
    ],
    [t]
  );

  const tierStyle = (tier: "bronze" | "silver" | "gold") =>
    tier === "gold"
      ? "from-yellow-400/30 to-orange-500/20 border-primary/50 text-primary"
      : tier === "silver"
      ? "from-slate-300/20 to-slate-500/10 border-slate-400/40 text-slate-200"
      : "from-orange-700/20 to-amber-800/10 border-amber-600/40 text-amber-300";

  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "Course",
        name: t("edu.seo.title"),
        description: t("edu.seo.desc"),
        inLanguage: locale === "pt" ? "pt-BR" : locale,
        provider: { "@type": "Organization", name: "IX Sala de Trading" },
        hasCourseInstance: MODULES.map((m) => ({
          "@type": "CourseInstance",
          name: m.shortTitle,
          description: m.summary,
          courseMode: "online",
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: t("edu.curriculum"),
        itemListElement: MODULES.map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: m.shortTitle,
          url: `https://www.salatradingelite.com/education/${m.slug}`,
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.salatradingelite.com/" },
          { "@type": "ListItem", position: 2, name: t("edu.eyebrow"), item: "https://www.salatradingelite.com/education" },
        ],
      },
    ],
    [MODULES, t, locale]
  );

  const pillars = useMemo(
    () => [
      { icon: BookOpen, h: "edu.pillar.start.h", p: "edu.pillar.start.p" },
      { icon: Globe2, h: "edu.pillar.macro.h", p: "edu.pillar.macro.p" },
      { icon: LineChart, h: "edu.pillar.tech.h", p: "edu.pillar.tech.p" },
      { icon: Shapes, h: "edu.pillar.patterns.h", p: "edu.pillar.patterns.p" },
      { icon: ShieldCheck, h: "edu.pillar.risk.h", p: "edu.pillar.risk.p" },
      { icon: Target, h: "edu.pillar.strategies.h", p: "edu.pillar.strategies.p" },
      { icon: Layers, h: "edu.pillar.advanced.h", p: "edu.pillar.advanced.p" },
      { icon: Video, h: "edu.pillar.webinars.h", p: "edu.pillar.webinars.p" },
    ] as const,
    []
  );

  const remaining = TOTAL_MODULES - completedCount;
  const subtitle = loading
    ? t("edu.curriculum.loading")
    : completedCount === 0
    ? t("edu.curriculum.start")
    : remaining === 1
    ? t("edu.curriculum.keepGoing.one")
    : t("edu.curriculum.keepGoing.many").replace("{n}", String(remaining));

  return (
    <>
      <SEO
        title={t("edu.seo.title")}
        description={t("edu.seo.desc")}
        keywords={t("edu.seo.keywords")}
        canonical="https://www.salatradingelite.com/education"
        type="article"
        jsonLd={jsonLd}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* HERO */}
        <header className="relative overflow-hidden border-b border-primary/15">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 left-1/3 h-[480px] w-[480px] rounded-full bg-primary/15 blur-[120px]" />
            <div className="absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full bg-orange-500/10 blur-[120px]" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="max-w-2xl"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-proxima text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {t("edu.eyebrow")}
                </span>
                <h1 className="mt-4 font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                  {t("edu.h1.lead")}{" "}
                  <span className="bg-gradient-to-br from-primary via-primary to-orange-400 bg-clip-text text-transparent">
                    {t("edu.h1.brand")}
                  </span>{" "}
                  {t("edu.h1.tail")}
                </h1>
                <p className="mt-5 max-w-xl text-base md:text-lg leading-relaxed text-muted-foreground">
                  {t("edu.intro")}
                </p>
              </motion.div>

              {/* Progress card */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="w-full lg:w-[360px] rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card/40 to-transparent backdrop-blur-2xl p-5 shadow-[0_20px_60px_-30px_hsl(48_100%_51%/0.4)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                    {t("edu.progress.label")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                    {totalXp.toLocaleString()} XP
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-4xl font-bold text-foreground">
                    {completedCount}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    / {TOTAL_MODULES} {t("edu.progress.modulesSuffix")}
                  </span>
                  <span className="ml-auto text-primary font-proxima font-bold text-lg">
                    {percent}%
                  </span>
                </div>
                <Progress value={percent} className="mt-3 h-2" />
                <div className="mt-4 flex items-center gap-1.5">
                  {MILESTONES.map((m) => {
                    const reached = percent >= m.pct;
                    const Icon = m.icon;
                    return (
                      <div
                        key={m.slug}
                        title={`${m.label} (${m.pct}%)`}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-all",
                          reached
                            ? `bg-gradient-to-br ${tierStyle(m.tier)} shadow-[0_0_20px_-8px_hsl(48_100%_51%/0.5)]`
                            : "border-border/30 bg-muted/10 text-muted-foreground/60"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[9px] font-proxima font-bold uppercase tracking-wider">
                          {m.pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </header>

        {/* Educational disclaimer — subtle, regulation compliant. */}
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 backdrop-blur-md">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              {t("edu.disclaimer")}
            </p>
          </div>
        </div>

        {/* MODULE GRID */}
        <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                {t("edu.curriculum")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <Link
              to="/profile"
              className="hidden md:inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/40 px-4 py-2 font-proxima text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary/60 hover:bg-primary/10 transition"
            >
              <Trophy className="h-4 w-4 text-primary" />
              {t("edu.viewBadges")}
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, idx) => {
              const isDone = completed.has(m.slug);
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.slug}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: idx * 0.05, ease: "easeOut" }}
                >
                  <Link
                    to={`/education/${m.slug}`}
                    className="group relative block h-full overflow-hidden rounded-2xl border border-primary/15 bg-card/40 backdrop-blur-2xl shadow-[0_20px_60px_-30px_hsl(48_100%_51%/0.25)] hover:border-primary/40 hover:shadow-[0_24px_70px_-25px_hsl(48_100%_51%/0.45)] transition-all"
                  >
                    {/* Hero image */}
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={m.hero}
                        alt={m.shortTitle}
                        loading="lazy"
                        width={1280}
                        height={640}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                      {/* badges overlay */}
                      <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/70 backdrop-blur px-2.5 py-1 font-proxima text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                          {t("eduMod.module")} {m.number}
                        </span>
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-proxima text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-[0_8px_20px_-8px_hsl(48_100%_51%/0.7)]">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("edu.completed")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/70 backdrop-blur px-2.5 py-1 font-proxima text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <Star className="h-3 w-3 text-primary" />
                            +50 XP
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <Icon className="h-7 w-7 text-primary drop-shadow-[0_4px_12px_hsl(48_100%_51%/0.8)]" />
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5">
                      <h3 className="font-heading text-lg font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {m.shortTitle}
                      </h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
                        {m.summary}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                          {m.read}
                        </span>
                        <span className="inline-flex items-center gap-1 font-proxima text-xs font-bold uppercase tracking-wider text-primary group-hover:gap-2 transition-all">
                          {isDone ? t("edu.review") : t("edu.start")}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Milestones rewards row */}
          <section className="mt-12">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-heading text-xl font-bold text-foreground">
                {t("edu.tierRewards")}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MILESTONES.map((m) => {
                const reached = percent >= m.pct;
                const Icon = m.icon;
                return (
                  <div
                    key={m.slug}
                    className={cn(
                      "rounded-2xl border p-4 backdrop-blur-2xl transition-all",
                      reached
                        ? `bg-gradient-to-br ${tierStyle(m.tier)} shadow-[0_20px_60px_-30px_hsl(48_100%_51%/0.5)]`
                        : "border-border/30 bg-card/30 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={cn("h-6 w-6", reached ? "" : "opacity-50")} />
                      {reached ? (
                        <span className="text-[10px] font-proxima font-bold uppercase tracking-wider">
                          {t("edu.unlocked")}
                        </span>
                      ) : (
                        <Lock className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </div>
                    <div className="mt-3 font-heading text-base font-bold">{m.label}</div>
                    <div className="text-[12px] mt-1">
                      {m.pct}% {t("edu.tier.complete")} · +{m.xp} XP
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SEO Pillars — full educational path with H2/H3 hierarchy & internal linking */}
          <section className="mt-16">
            <header className="mb-8 max-w-3xl">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                {t("edu.pillars.title")}
              </h2>
              <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">
                {t("edu.pillars.subtitle")}
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              {pillars.map(({ icon: Icon, h, p }) => (
                <article
                  key={h}
                  className="group relative overflow-hidden rounded-2xl border border-primary/15 bg-card/40 backdrop-blur-2xl p-5 hover:border-primary/40 hover:shadow-[0_24px_70px_-25px_hsl(48_100%_51%/0.45)] transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading text-base md:text-lg font-bold text-foreground">
                        {t(h)}
                      </h3>
                      <p className="mt-1.5 text-[13px] md:text-sm leading-relaxed text-muted-foreground">
                        {t(p)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Internal linking block — boosts crawlability & topical authority */}
            <nav
              aria-label="Education internal links"
              className="mt-8 flex flex-wrap gap-2"
            >
              <Link
                to="/webinars"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 font-proxima text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/15 transition"
              >
                <Video className="h-3.5 w-3.5" />
                {t("edu.pillars.linkWebinars")}
              </Link>
              <Link
                to="/videos"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 font-proxima text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/15 transition"
              >
                <Play className="h-3.5 w-3.5" />
                {t("edu.pillars.linkVideos")}
              </Link>
              <Link
                to="/signals"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 font-proxima text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/15 transition"
              >
                <LineChart className="h-3.5 w-3.5" />
                {t("edu.pillars.linkSignals")}
              </Link>
              <Link
                to="/chatroom"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 font-proxima text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/15 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t("edu.pillars.linkChat")}
              </Link>
            </nav>
          </section>

          {/* CTA strip */}
          <section className="mt-12 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.10] via-card/40 to-transparent p-6 md:p-10 text-center">
            <Play className="mx-auto h-10 w-10 text-primary mb-3" />
            <h3 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
              {t("edu.cta.title")}
            </h3>
            <p className="mt-2 max-w-xl mx-auto text-muted-foreground">{t("edu.cta.desc")}</p>
            <div className="mt-5 flex flex-wrap gap-3 justify-center">
              <Link
                to="/webinars"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition"
              >
                {t("edu.cta.joinWebinars")}
              </Link>
              <Link
                to="/videos"
                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/40 px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-foreground hover:border-primary/60 hover:bg-primary/10 transition"
              >
                {t("edu.cta.openVideos")}
              </Link>
            </div>
          </section>

          <KeywordCrossLinks current="education" />
        </main>
      </div>
    </>
  );
};

export default Education;
