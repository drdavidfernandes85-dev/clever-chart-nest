import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  pair: string;
  direction: string;
  entry_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  /** Trigger lazy load (e.g. when row enters viewport). Defaults to true. */
  enabled?: boolean;
  /** Visual size of the badge */
  size?: "sm" | "md" | "lg";
}

interface Score {
  score: number;
  rating: "weak" | "fair" | "good" | "strong" | "elite";
  rationale: string;
  risk_reward?: number;
}

const colorFor = (s: number) => {
  if (s >= 80)
    return {
      ring: "ring-emerald-400/70",
      text: "text-emerald-300",
      bg: "bg-gradient-to-br from-emerald-500/30 to-emerald-700/20",
      glow: "shadow-[0_0_24px_-4px_hsl(145_70%_50%/0.6)]",
      label: "STRONG",
      labelClass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
    };
  if (s >= 60)
    return {
      ring: "ring-primary/70",
      text: "text-primary",
      bg: "bg-gradient-to-br from-primary/30 to-primary/10",
      glow: "shadow-[0_0_24px_-4px_hsl(48_100%_51%/0.55)]",
      label: "FAIR",
      labelClass: "bg-primary/20 text-primary border-primary/40",
    };
  return {
    ring: "ring-red-400/70",
    text: "text-red-300",
    bg: "bg-gradient-to-br from-red-500/30 to-red-700/20",
    glow: "shadow-[0_0_24px_-4px_hsl(0_70%_55%/0.55)]",
    label: "WEAK",
    labelClass: "bg-red-500/20 text-red-300 border-red-400/40",
  };
};

const cache = new Map<string, Score>();

const sizeMap = {
  sm: { box: "h-7 w-7", text: "text-[10px]", icon: "h-3 w-3" },
  md: { box: "h-10 w-10", text: "text-sm", icon: "h-4 w-4" },
  lg: { box: "h-14 w-14", text: "text-lg", icon: "h-5 w-5" },
} as const;

const AIScoreBadge = ({
  pair,
  direction,
  entry_price,
  stop_loss,
  take_profit,
  enabled = true,
  size = "sm",
}: Props) => {
  const key = `${pair}|${direction}|${entry_price}|${stop_loss}|${take_profit}`;
  const [score, setScore] = useState<Score | null>(() => cache.get(key) ?? null);
  const [loading, setLoading] = useState(false);
  const tried = useRef(false);
  const dims = sizeMap[size];

  useEffect(() => {
    if (!enabled || score || loading || tried.current) return;
    tried.current = true;
    setLoading(true);
    supabase.functions
      .invoke("ai-signal-score", {
        body: { pair, direction, entry_price, stop_loss, take_profit },
      })
      .then(({ data, error }) => {
        if (!error && data?.score != null) {
          cache.set(key, data);
          setScore(data);
        }
      })
      .finally(() => setLoading(false));
  }, [enabled, key, pair, direction, entry_price, stop_loss, take_profit, score, loading]);

  if (loading && !score) {
    return (
      <span
        className={`inline-flex ${dims.box} items-center justify-center rounded-full bg-muted/40 ring-1 ring-border/40`}
        title="Scoring with AI…"
      >
        <Loader2 className={`${dims.icon} animate-spin text-primary`} />
      </span>
    );
  }

  if (!score) {
    return (
      <span
        className={`inline-flex ${dims.box} items-center justify-center rounded-full bg-muted/30 ring-1 ring-border/30 text-muted-foreground`}
        title="AI score unavailable"
      >
        <Sparkles className={dims.icon} />
      </span>
    );
  }

  const c = colorFor(score.score);
  return (
    <span
      className={`inline-flex ${dims.box} items-center justify-center rounded-full ${c.bg} ring-2 ${c.ring} ${c.glow} font-mono font-extrabold tabular-nums ${c.text} ${dims.text}`}
      title={`AI Score · ${score.rating.toUpperCase()} · ${score.rationale}`}
    >
      {score.score}
    </span>
  );
};

/**
 * Score + rationale block — reads from the same cache the badge populates.
 * Use inside the signal card body for the prominent AI section.
 */
export const AIScorePanel = ({
  pair,
  direction,
  entry_price,
  stop_loss,
  take_profit,
}: Props) => {
  const key = `${pair}|${direction}|${entry_price}|${stop_loss}|${take_profit}`;
  const [score, setScore] = useState<Score | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    if (score) return;
    const id = setInterval(() => {
      const c = cache.get(key);
      if (c) {
        setScore(c);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [key, score]);

  if (!score) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent px-3 py-2.5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-primary/80">
            AI Analysis
          </p>
          <p className="text-[11px] text-muted-foreground">Analyzing setup with AI…</p>
        </div>
      </div>
    );
  }

  const c = colorFor(score.score);
  return (
    <div className="flex items-stretch gap-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background/40 to-transparent p-2.5">
      {/* Big score circle */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1">
        <span
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${c.bg} ring-2 ${c.ring} ${c.glow} font-mono text-base font-extrabold tabular-nums ${c.text}`}
        >
          {score.score}
        </span>
        <span
          className={`rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider ${c.labelClass}`}
        >
          {c.label}
        </span>
      </div>

      {/* Rationale */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-primary/90">
            AI Analysis
            {score.risk_reward != null && (
              <span className="ml-1.5 text-muted-foreground/70">
                · R:R {score.risk_reward.toFixed(2)}
              </span>
            )}
          </p>
        </div>
        <p className="text-[11px] leading-snug text-foreground/85">{score.rationale}</p>
      </div>
    </div>
  );
};

/** Backwards-compat alias for older imports. */
export const AIScoreExplanation = AIScorePanel;

export default AIScoreBadge;
