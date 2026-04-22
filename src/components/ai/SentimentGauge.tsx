import { useEffect, useState } from "react";
import { Gauge, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Sentiment {
  score: number;
  label: string;
  reasoning: string;
  generatedAt: string;
}

const STORAGE_KEY = "infinox-sentiment";

const labelColor = (score: number) => {
  if (score < 25) return "text-red-500";
  if (score < 45) return "text-orange-400";
  if (score < 55) return "text-muted-foreground";
  if (score < 75) return "text-emerald-400";
  return "text-emerald-500";
};

const SentimentGauge = () => {
  const [data, setData] = useState<Sentiment | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed: Sentiment = JSON.parse(cached);
          const ageMin = (Date.now() - new Date(parsed.generatedAt).getTime()) / 60000;
          if (ageMin < 30) {
            setData(parsed);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    try {
      const { data: result } = await supabase.functions.invoke("ai-sentiment");
      if (result?.score != null) {
        setData(result);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  // Semicircle gauge: 180° arc
  const score = data?.score ?? 50;
  const angle = (score / 100) * 180 - 90; // -90 to 90

  return (
    <div className="rounded-2xl border border-border/30 bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Gauge className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">Market Sentiment</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={() => load(true)} disabled={loading} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="relative mx-auto mt-2 h-28 w-full max-w-[260px]">
        <svg viewBox="0 0 200 110" className="h-full w-full">
          <defs>
            <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
              <stop offset="50%" stopColor="hsl(45, 100%, 50%)" />
              <stop offset="100%" stopColor="hsl(142, 71%, 45%)" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path
            d="M 15 100 A 85 85 0 0 1 185 100"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.3"
          />
          {/* Active arc */}
          <path
            d="M 15 100 A 85 85 0 0 1 185 100"
            fill="none"
            stroke="url(#gauge-grad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray="267"
            strokeDashoffset={267 - (267 * score) / 100}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
          {/* Needle */}
          <g transform={`translate(100 100) rotate(${angle})`} style={{ transition: "transform 0.8s ease-out" }}>
            <line x1="0" y1="0" x2="0" y2="-72" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="6" fill="hsl(var(--primary))" />
          </g>
        </svg>
      </div>

      <div className="mt-1 text-center">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing…
          </div>
        ) : data ? (
          <>
            <div className={`font-display text-3xl font-semibold ${labelColor(score)}`}>{score}</div>
            <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground">{data.label}</div>
            <p className="mt-2 text-[11px] text-muted-foreground/80 leading-snug px-2">{data.reasoning}</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No data.</p>
        )}
      </div>
    </div>
  );
};

export default SentimentGauge;
