import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import PerformanceAnalytics from "@/components/dashboard/PerformanceAnalytics";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeWeeklySummary } from "@/i18n/summary";

interface WeeklyReport {
  id: string;
  week_start: string;
  summary: string;
  metrics: { trades?: number; pnl?: number; win_rate?: number };
  created_at: string;
}

const Analytics = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("weekly_reports" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(10);
    setReports((data ?? []) as unknown as WeeklyReport[]);
    setLoading(false);
  };

  useEffect(() => { loadReports(); /* eslint-disable-next-line */ }, [user]);

  const generateReport = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-weekly-report", {
        body: { userId: user.id },
      });
      if (error) throw error;
      toast.success(t("analytics.generated"));
      await loadReports();
    } catch (e: any) {
      toast.error(e.message || t("analytics.generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO
        title="My Analytics | Elite Live Trading Room"
        description="Personal trading analytics, equity curve and AI-generated weekly reports."
      />
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
            <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
              {t("analytics.headerTitle1")} <span className="text-primary">{t("analytics.headerTitle2")}</span>
            </span>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> {t("common.back")}
            </Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground uppercase tracking-tight">
              {t("analytics.headerTitle1")} <span className="text-primary">{t("analytics.headerTitle2")}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("analytics.subtitle")}
            </p>
          </div>
          <Button onClick={generateReport} disabled={generating} className="gap-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/80">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? t("analytics.generating") : t("analytics.generate")}
          </Button>
        </div>

        <PerformanceAnalytics />

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">{t("analytics.aiReports")}</h2>
          {loading ? (
            <div className="rounded-2xl border border-border/40 bg-card p-6 text-center text-sm text-muted-foreground">
              {t("analytics.loadingReports")}
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card p-6 text-center text-sm text-muted-foreground">
              {t("analytics.noReports")}
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <article key={r.id} className="rounded-2xl border border-border/40 bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t("analytics.weekOfLabel")} {new Date(r.week_start).toLocaleDateString()}
                    </p>
                    {r.metrics?.pnl != null && (
                      <span className={`text-xs font-bold ${r.metrics.pnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {r.metrics.pnl >= 0 ? "+" : ""}${r.metrics.pnl.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{r.summary}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Analytics;
