import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

interface Opportunity {
  pair: string;
  bias: "bullish" | "bearish" | "neutral";
  rationale: string;
}
interface RiskAlert {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
}
interface Insights {
  market_summary: string;
  key_opportunities: Opportunity[];
  risk_alerts: RiskAlert[];
  generatedAt: string;
}

const STORAGE_KEY_BASE = "infinox-smart-insights";
const STALE_MIN = 30;

const biasIcon = (b: Opportunity["bias"]) =>
  b === "bullish" ? (
    <TrendingUp className="h-3 w-3 text-emerald-400" />
  ) : b === "bearish" ? (
    <TrendingDown className="h-3 w-3 text-red-400" />
  ) : (
    <Minus className="h-3 w-3 text-muted-foreground" />
  );

const sevColor = (s: RiskAlert["severity"]) =>
  s === "high"
    ? "border-red-500/40 bg-red-500/10 text-red-300"
    : s === "medium"
      ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";

const SmartInsights = () => {
  const { locale, t } = useLanguage();
  const storageKey = `${STORAGE_KEY_BASE}.${locale}`;
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed: Insights = JSON.parse(cached);
          const ageMin = (Date.now() - new Date(parsed.generatedAt).getTime()) / 60000;
          if (ageMin < STALE_MIN) {
            setData(parsed);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-smart-insights", {
        body: { locale },
      });
      if (error) throw error;
      if (result?.market_summary) {
        setData(result);
        localStorage.setItem(storageKey, JSON.stringify(result));
      }
    } catch (e: any) {
      toast({ title: t("ai.insightsError"), description: e?.message || t("ai.tryAgain"), variant: "destructive" });
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

  const biasLabel = (b: Opportunity["bias"]) =>
    b === "bullish" ? t("ai.bullish") : b === "bearish" ? t("ai.bearish") : t("ai.neutral");

  return (
    <section
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card/80 to-card p-5 shadow-[0_0_40px_-10px_hsl(48_100%_51%/0.25)] backdrop-blur-xl"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-sm font-bold text-foreground tracking-tight">{t("ai.smartInsights")}</h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {data?.generatedAt
                ? `${t("ai.updated")} ${new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : t("ai.poweredBy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" /> {t("ai.poweredBy")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => load(true)}
            disabled={loading}
            aria-label={t("ai.refresh")}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> {t("ai.analyzing")}
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Market summary */}
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-primary/80">{t("ai.marketSummary")}</p>
            <p className="text-sm leading-relaxed text-foreground/90">{data.market_summary}</p>
          </div>

          {/* Opportunities */}
          {data.key_opportunities?.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-primary/80">{t("ai.keyOpportunities")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.key_opportunities.map((o, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border/40 bg-background/40 p-3 transition-colors hover:border-primary/30"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      {biasIcon(o.bias)}
                      <span className="font-mono text-xs font-bold tracking-wider text-foreground">{o.pair}</span>
                      <span
                        className={`ml-auto text-[9px] font-bold uppercase tracking-widest ${
                          o.bias === "bullish"
                            ? "text-emerald-400"
                            : o.bias === "bearish"
                              ? "text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {biasLabel(o.bias)}
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-snug text-muted-foreground">{o.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk alerts */}
          {data.risk_alerts?.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-primary/80">{t("ai.riskAlerts")}</p>
              <ul className="space-y-1.5">
                {data.risk_alerts.map((r, i) => (
                  <li key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${sevColor(r.severity)}`}>
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{r.title}</p>
                      <p className="text-[11px] leading-snug opacity-90">{r.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("ai.insightsUnavailable")}</p>
      )}
    </section>
  );
};

export default SmartInsights;
