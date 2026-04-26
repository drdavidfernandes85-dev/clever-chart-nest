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
}

interface Score {
  score: number;
  rating: "weak" | "fair" | "good" | "strong" | "elite";
  rationale: string;
  risk_reward?: number;
}

const colorFor = (s: number) => {
  if (s > 80) return { ring: "ring-emerald-400/60", text: "text-emerald-400", bg: "bg-emerald-500/15" };
  if (s >= 60) return { ring: "ring-primary/60", text: "text-primary", bg: "bg-primary/15" };
  return { ring: "ring-red-400/60", text: "text-red-400", bg: "bg-red-500/15" };
};

const cache = new Map<string, Score>();

const AIScoreBadge = ({ pair, direction, entry_price, stop_loss, take_profit, enabled = true }: Props) => {
  const key = `${pair}|${direction}|${entry_price}|${stop_loss}|${take_profit}`;
  const [score, setScore] = useState<Score | null>(() => cache.get(key) ?? null);
  const [loading, setLoading] = useState(false);
  const tried = useRef(false);

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
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 ring-1 ring-border/40" title="Scoring with AI…">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      </span>
    );
  }

  if (!score) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/30 ring-1 ring-border/30 text-[9px] text-muted-foreground" title="AI score unavailable">
        <Sparkles className="h-3 w-3" />
      </span>
    );
  }

  const c = colorFor(score.score);
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${c.bg} ring-1 ${c.ring} font-mono text-[10px] font-bold ${c.text}`}
      title={`AI Score · ${score.rating.toUpperCase()} · ${score.rationale}`}
    >
      {score.score}
    </span>
  );
};

export const AIScoreExplanation = ({ pair, direction, entry_price, stop_loss, take_profit }: Props) => {
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
    }, 600);
    return () => clearInterval(id);
  }, [key, score]);

  if (!score) {
    return (
      <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px] text-muted-foreground/80">
        <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" /> AI analyzing setup…
      </p>
    );
  }
  return (
    <p className="px-2.5 py-1.5 text-[10.5px] leading-snug text-muted-foreground/90">
      <span className="font-bold text-primary">AI:</span> {score.rationale}
    </p>
  );
};

export default AIScoreBadge;
