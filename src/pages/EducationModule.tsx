import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Trophy,
  Star,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";
import { MODULES, TOTAL_MODULES } from "@/data/educationContent";
import { useEducationProgress } from "@/hooks/useEducationProgress";

const EducationModule = () => {
  const { slug } = useParams<{ slug: string }>();
  const module = useMemo(() => MODULES.find((m) => m.slug === slug), [slug]);
  const idx = useMemo(() => MODULES.findIndex((m) => m.slug === slug), [slug]);
  const { completed, complete, uncomplete, loading } = useEducationProgress(TOTAL_MODULES);
  const [submitting, setSubmitting] = useState(false);

  if (!module) return <Navigate to="/education" replace />;

  const isDone = completed.has(module.slug);
  const Icon = module.icon;
  const next = idx >= 0 && idx < MODULES.length - 1 ? MODULES[idx + 1] : null;

  const onComplete = async () => {
    setSubmitting(true);
    const res = await complete(module.slug);
    setSubmitting(false);
    if (!res) {
      toast.error("Couldn't save your progress. Please try again.");
      return;
    }
    if (res.already_completed) {
      toast.info("You've already completed this module.");
      return;
    }
    toast.success(`+${res.xp_awarded ?? 50} XP earned!`, {
      description: `Module complete — you're at ${res.percent ?? 0}% of the curriculum.`,
    });
    if (res.new_badges?.length) {
      // small celebration per badge
      res.new_badges.forEach((b, i) => {
        setTimeout(() => {
          toast(`🏅 Badge unlocked: ${b.replace(/^edu_/, "").replace(/_/g, " ")}`, {
            duration: 4500,
          });
        }, 600 + i * 350);
      });
    }
  };

  const onUncomplete = async () => {
    await uncomplete(module.slug);
    toast.info("Module reset. You can complete it again.");
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: module.title,
    description: module.summary,
    timeRequired: module.read,
    isPartOf: {
      "@type": "Course",
      name: "IX Education Center",
    },
  };

  const Body = module.body;

  return (
    <>
      <SEO
        title={`${module.shortTitle} | Education | IX Live Trading Room`}
        description={module.summary}
        canonical={`https://www.salatradingelite.com/education/${module.slug}`}
        type="article"
        jsonLd={jsonLd}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* HERO with image */}
        <header className="relative overflow-hidden border-b border-primary/15">
          <div className="absolute inset-0">
            <img
              src={module.hero}
              alt=""
              width={1280}
              height={640}
              className="h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
            <div className="absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-primary/15 blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
            <Link
              to="/education"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Education Center
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-proxima text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  <Icon className="h-3.5 w-3.5" />
                  Module {module.number}
                </span>
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  {module.read}
                </span>
                {isDone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-proxima text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-[0_8px_20px_-8px_hsl(48_100%_51%/0.7)]">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-primary" />
                  +50 XP on completion
                </span>
              </div>
              <h1 className="mt-4 font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                {module.title}
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground leading-relaxed">
                {module.summary}
              </p>
            </motion.div>
          </div>
        </header>

        {/* ARTICLE */}
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <article className="relative overflow-hidden rounded-3xl border border-primary/15 bg-card/50 backdrop-blur-2xl shadow-[0_20px_60px_-30px_hsl(48_100%_51%/0.25)]">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
            </div>
            <div className="relative px-6 py-8 md:px-10 md:py-12 space-y-4">
              <Body />
            </div>
          </article>

          {/* Completion CTA */}
          <section className="mt-8 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-card/40 to-transparent p-6 md:p-8">
            {isDone ? (
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/15 p-3">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-heading text-lg font-bold text-foreground">
                      Module complete
                    </div>
                    <div className="text-sm text-muted-foreground">
                      You earned XP and unlocked the {module.shortTitle} badge.
                    </div>
                  </div>
                </div>
                <div className="md:ml-auto flex flex-wrap gap-2">
                  <button
                    onClick={onUncomplete}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-4 py-2 font-proxima text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-background/80 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  {next ? (
                    <Link
                      to={`/education/${next.slug}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition"
                    >
                      Next: {next.shortTitle}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <Link
                      to="/education"
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition"
                    >
                      Back to curriculum
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/15 p-3">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-heading text-lg font-bold text-foreground">
                      Ready to claim your XP?
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Mark this module complete to earn +50 XP and unlock the{" "}
                      <span className="text-primary font-semibold">{module.shortTitle}</span> badge.
                    </div>
                  </div>
                </div>
                <button
                  onClick={onComplete}
                  disabled={submitting || loading}
                  className={cn(
                    "md:ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Module Complete
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* Module nav */}
          <nav className="mt-6 grid gap-3 sm:grid-cols-2">
            {idx > 0 && (
              <Link
                to={`/education/${MODULES[idx - 1].slug}`}
                className="group rounded-xl border border-border/40 bg-card/30 p-4 hover:border-primary/40 hover:bg-card/50 transition"
              >
                <div className="text-[10px] font-proxima font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  ← Previous
                </div>
                <div className="mt-1 font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
                  {MODULES[idx - 1].shortTitle}
                </div>
              </Link>
            )}
            {next && (
              <Link
                to={`/education/${next.slug}`}
                className={cn(
                  "group rounded-xl border border-border/40 bg-card/30 p-4 hover:border-primary/40 hover:bg-card/50 transition text-right",
                  idx === 0 && "sm:col-start-2"
                )}
              >
                <div className="text-[10px] font-proxima font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Next →
                </div>
                <div className="mt-1 font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
                  {next.shortTitle}
                </div>
              </Link>
            )}
          </nav>
        </main>
      </div>
    </>
  );
};

export default EducationModule;
