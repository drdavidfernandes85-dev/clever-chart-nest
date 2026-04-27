import { useEffect, useState } from "react";
import { Brain, RefreshCw, Loader2, Sparkles, CheckCircle2, AlertCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

interface ActionItem {
  title: string;
  detail: string;
}
interface Coaching {
  empty?: boolean;
  message?: string;
  headline?: string;
  strengths?: string[];
  weaknesses?: string[];
  action_items?: ActionItem[];
  stats?: { trades: number; win_rate: number; total_pnl: number };
  generatedAt: string;
}

const STORAGE_KEY_BASE = "infinox-perf-coach";
const STALE_HOURS = 12;

const PerformanceCoach = () => {
  const { locale, t } = useLanguage();
  const storageKey = `${STORAGE_KEY_BASE}.${locale}`;
  const [data, setData] = useState<Coaching | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed: Coaching = JSON.parse(cached);
          const ageH = (Date.now() - new Date(parsed.generatedAt).getTime()) / 36e5;
          if (ageH < STALE_HOURS) {
            setData(parsed);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-performance-coach", {
        body: { locale },
      });
      if (error) throw error;
      if (result) {
        setData(result);
        localStorage.setItem(storageKey, JSON.stringify(result));
      }
    } catch (e: any) {
      toast({ title: t("ai.perfCoachError"), description: e?.message || t("ai.tryAgain"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const isLoading = loading && !data;

  return (
    <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card/80 to-card p-6 shadow-[0_0_40px_-10px_hsl(48_100%_51%/0.25)] backdrop-blur-xl">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Brain className="h-5 w-5 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground tracking-tight">{t("ai.perfCoach")}</h2>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {data?.generatedAt
                ? `${t("ai.updated")} ${new Date(data.generatedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
                : t("ai.perfCoachSubtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" /> {t("ai.poweredBy")}
          </span>
          <Button variant="ghost" size="icon" onClick={() => load(true)} disabled={loading} aria-label={t("ai.refresh")}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> {t("ai.analyzingEdge")}
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : data?.empty ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-background/40 p-6 text-center text-sm text-muted-foreground">
          {data.message}
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Headline + stats */}
          <div className="rounded-xl border border-primary/20 bg-background/40 p-4">
            <p className="text-sm leading-relaxed text-foreground">{data.headline}</p>
            {data.stats && (
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border/30 pt-3 text-center">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t("ai.trades")}</p>
                  <p className="font-mono text-base font-bold text-foreground">{data.stats.trades}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t("ai.winRate")}</p>
                  <p className="font-mono text-base font-bold text-primary">{data.stats.win_rate}%</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t("ai.pnl")}</p>
                  <p
                    className={`font-mono text-base font-bold tabular-nums ${
                      data.stats.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {data.stats.total_pnl >= 0 ? "+" : ""}
                    {data.stats.total_pnl}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Strengths + Weaknesses */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> {t("ai.strengths")}
              </p>
              <ul className="space-y-1.5 text-xs text-foreground/90">
                {(data.strengths ?? []).map((s, i) => (
                  <li key={i} className="leading-snug">• {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-red-400">
                <AlertCircle className="h-3 w-3" /> {t("ai.weaknesses")}
              </p>
              <ul className="space-y-1.5 text-xs text-foreground/90">
                {(data.weaknesses ?? []).map((s, i) => (
                  <li key={i} className="leading-snug">• {s}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action items */}
          {data.action_items?.length ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                <Target className="h-3 w-3" /> {t("ai.actionPlan")}
              </p>
              <div className="space-y-2">
                {data.action_items.map((a, i) => (
                  <div key={i} className="rounded-xl border border-primary/20 bg-background/40 p-3">
                    <p className="mb-1 text-xs font-bold text-foreground">
                      <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-primary-foreground">
                        {i + 1}
                      </span>
                      {a.title}
                    </p>
                    <p className="text-[11.5px] leading-snug text-muted-foreground">{a.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("ai.perfCoachUnavailable")}</p>
      )}
    </section>
  );
};

export default PerformanceCoach;
