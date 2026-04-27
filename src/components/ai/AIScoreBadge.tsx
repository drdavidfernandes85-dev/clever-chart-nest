import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Locale } from "@/i18n/translations";

interface Props {
  signalId?: string;
  pair: string;
  direction: string;
  entry_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  author?: string | null;
  /** Trigger lazy load (e.g. when row enters viewport). Defaults to true. */
  enabled?: boolean;
  /** Visual size of the badge */
  size?: "sm" | "md" | "lg";
}

interface Score {
  score: number;
  rating?: "weak" | "fair" | "good" | "strong" | "elite" | string;
  rationale: string;
  risk_reward?: number | null;
  generatedAt?: string;
}

type ScoreTier = "strong" | "fair" | "weak";

type ScoreTheme = {
  badge: string;
  panel: string;
  text: string;
  border: string;
  glow: string;
  tier: ScoreTier;
  labelClass: string;
};

const scoreThemeFor = (score: number): ScoreTheme => {
  if (score >= 80) {
    return {
      badge: "bg-[hsl(var(--score-strong)/0.92)]",
      panel: "bg-[hsl(var(--score-strong)/0.10)]",
      text: "text-[hsl(var(--score-strong-foreground))]",
      border: "border-[hsl(var(--score-strong)/0.55)] ring-[hsl(var(--score-strong)/0.45)]",
      glow: "shadow-[0_0_28px_-6px_hsl(var(--score-strong)/0.68)]",
      tier: "strong",
      labelClass: "border-[hsl(var(--score-strong)/0.45)] bg-[hsl(var(--score-strong)/0.14)] text-[hsl(var(--score-strong-foreground))]",
    };
  }

  if (score >= 60) {
    return {
      badge: "bg-primary",
      panel: "bg-primary/10",
      text: "text-primary-foreground",
      border: "border-primary/60 ring-primary/45",
      glow: "shadow-[0_0_28px_-6px_hsl(var(--primary)/0.75)]",
      tier: "fair",
      labelClass: "border-primary/45 bg-primary/15 text-primary",
    };
  }

  return {
    badge: "bg-[hsl(var(--score-weak)/0.92)]",
    panel: "bg-[hsl(var(--score-weak)/0.10)]",
    text: "text-[hsl(var(--score-weak-foreground))]",
    border: "border-[hsl(var(--score-weak)/0.55)] ring-[hsl(var(--score-weak)/0.45)]",
    glow: "shadow-[0_0_28px_-6px_hsl(var(--score-weak)/0.68)]",
    tier: "weak",
    labelClass: "border-[hsl(var(--score-weak)/0.45)] bg-[hsl(var(--score-weak)/0.14)] text-[hsl(var(--score-weak-foreground))]",
  };
};

const scoreCache = new Map<string, Score>();
const requestCache = new Map<string, Promise<Score>>();

const clampScore = (value: unknown) => Math.max(0, Math.min(100, Math.round(Number(value))));

const normalizeScore = (data: unknown): Score => {
  const raw = data as Partial<Score> | null;
  const score = clampScore(raw?.score);

  if (!Number.isFinite(score) || !raw?.rationale || typeof raw.rationale !== "string") {
    throw new Error("AI score response was incomplete");
  }

  return {
    score,
    rating: raw.rating,
    rationale: raw.rationale,
    risk_reward: raw.risk_reward == null ? null : Number(raw.risk_reward),
    generatedAt: raw.generatedAt,
  };
};

const createScoreKey = ({
  signalId,
  pair,
  direction,
  entry_price,
  stop_loss,
  take_profit,
  author,
}: Props, locale: string) =>
  [signalId || pair, direction, entry_price, stop_loss ?? "", take_profit ?? "", author ?? "", locale].join("|");

const requestSignalScore = (key: string, props: Props, locale: Locale) => {
  const cached = scoreCache.get(key);
  if (cached) return Promise.resolve(cached);

  const existingRequest = requestCache.get(key);
  if (existingRequest) return existingRequest;

  const request = supabase.functions
    .invoke("ai-signal-score", {
      body: {
        symbol: props.pair,
        pair: props.pair,
        direction: props.direction,
        entry: props.entry_price,
        entry_price: props.entry_price,
        sl: props.stop_loss ?? null,
        stop_loss: props.stop_loss ?? null,
        tp: props.take_profit ?? null,
        take_profit: props.take_profit ?? null,
        author: props.author ?? null,
        locale,
      },
    })
    .then(({ data, error }) => {
      if (error) throw new Error(error.message || "AI signal scoring failed");
      const normalized = normalizeScore(data);
      scoreCache.set(key, normalized);
      return normalized;
    })
    .finally(() => requestCache.delete(key));

  requestCache.set(key, request);
  return request;
};

const useSignalScore = (props: Props) => {
  const { locale } = useLanguage();
  const key = useMemo(() => createScoreKey(props, locale), [
    locale,
    props.signalId,
    props.pair,
    props.direction,
    props.entry_price,
    props.stop_loss,
    props.take_profit,
    props.author,
  ]);
  const [score, setScore] = useState<Score | null>(() => scoreCache.get(key) ?? null);
  const [loading, setLoading] = useState(!score && props.enabled !== false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (props.enabled === false) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const cached = scoreCache.get(key);
    if (cached) {
      setScore(cached);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    requestSignalScore(key, props, locale)
      .then((result) => {
        if (!cancelled) setScore(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "AI analysis unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, locale, props.enabled, props.pair, props.direction, props.entry_price, props.stop_loss, props.take_profit, props.author]);

  return { score, loading, error };
};

const sizeMap = {
  sm: { box: "h-8 min-w-10 px-2", text: "text-xs", icon: "h-3 w-3" },
  md: { box: "h-11 min-w-14 px-3", text: "text-base", icon: "h-4 w-4" },
  lg: { box: "h-14 min-w-16 px-4", text: "text-xl", icon: "h-5 w-5" },
} as const;

const tierLabelKey = (tier: ScoreTier) =>
  tier === "strong" ? "ai.score.strong" : tier === "fair" ? "ai.score.fair" : "ai.score.weak";

const AIScoreBadge = (props: Props) => {
  const { score, loading } = useSignalScore(props);
  const { t } = useLanguage();
  const dims = sizeMap[props.size ?? "sm"];

  if (loading && !score) {
    return (
      <span
        className={`inline-flex ${dims.box} items-center justify-center rounded-full border border-primary/30 bg-primary/10 ring-1 ring-primary/25`}
        title={t("ai.score.analyzing")}
      >
        <Loader2 className={`${dims.icon} animate-spin text-primary`} />
      </span>
    );
  }

  if (!score) {
    return (
      <span
        className={`inline-flex ${dims.box} items-center justify-center rounded-full border border-border/40 bg-muted/30 text-muted-foreground ring-1 ring-border/30`}
        title={t("ai.score.unavailable")}
      >
        <Sparkles className={dims.icon} />
      </span>
    );
  }

  const theme = scoreThemeFor(score.score);
  const label = t(tierLabelKey(theme.tier) as any);
  return (
    <span
      className={`inline-flex ${dims.box} items-center justify-center rounded-full border ${theme.badge} ${theme.border} ${theme.glow} font-mono font-extrabold tabular-nums ${theme.text} ${dims.text}`}
      title={`${t("ai.score.label")} · ${label} · ${score.rationale}`}
    >
      {score.score}
    </span>
  );
};

export const AIScorePanel = (props: Props) => {
  const { score, loading, error } = useSignalScore(props);
  const { t } = useLanguage();

  if (loading && !score) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-card/80 px-3 py-3 shadow-ix-card">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 ring-1 ring-primary/25">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-primary/85">
            {t("ai.score.analysis")}
          </p>
          <p className="text-xs text-muted-foreground">{t("ai.score.analyzing")}</p>
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-destructive/35 bg-destructive/15">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-destructive">
            {t("ai.score.analysis")}
          </p>
          <p className="text-xs text-foreground/80">{error || t("ai.score.unavailable")}</p>
        </div>
      </div>
    );
  }

  const theme = scoreThemeFor(score.score);
  const tierLabel = t(tierLabelKey(theme.tier) as any);

  return (
    <div className={`rounded-lg border ${theme.panel} ${theme.border} p-3 shadow-ix-card`}>
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span
            className={`inline-flex h-16 w-16 items-center justify-center rounded-full border ${theme.badge} ${theme.border} ${theme.glow} font-mono text-2xl font-extrabold tabular-nums ${theme.text}`}
            aria-label={`AI score ${score.score} out of 100`}
          >
            {score.score}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider ${theme.labelClass}`}
          >
            {t("ai.score.label")}
          </span>
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${theme.labelClass}`}>
              {tierLabel}
            </span>
            {score.risk_reward != null && Number.isFinite(score.risk_reward) && (
              <span className="rounded-full border border-border/45 bg-background/55 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                R:R {Number(score.risk_reward).toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-primary/90">
              {t("ai.score.analysis")}
            </p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{score.rationale}</p>
        </div>
      </div>
    </div>
  );
};

/** Backwards-compat alias for older imports. */
export const AIScoreExplanation = AIScorePanel;

export default AIScoreBadge;
