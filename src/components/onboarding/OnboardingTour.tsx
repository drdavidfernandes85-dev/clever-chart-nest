import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Step {
  route: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    route: "/dashboard",
    title: "Your Command Center",
    body: "Daily AI briefing, market sentiment, news, calendar and live tickers — all in one place.",
  },
  {
    route: "/live-chart",
    title: "Pro Charts + Pair Intel",
    body: "Multi-timeframe charts with related news and signals filtered to the current pair.",
  },
  {
    route: "/chatroom",
    title: "Live Trading Room",
    body: "Real-time chat with mentors and traders. Mention with @, reply, react.",
  },
  {
    route: "/signals",
    title: "Trading Signals",
    body: "Live and historical signals from the moderators with full entry/SL/TP context.",
  },
  {
    route: "/leaderboard",
    title: "Climb the Leaderboard",
    body: "Log trades to earn XP, unlock badges and rank up against the community.",
  },
];

const OnboardingTour = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase.from as any)("user_settings")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        await (supabase.from as any)("user_settings").insert({
          user_id: user.id,
          onboarding_completed: false,
        });
        setActive(true);
      } else if (!data.onboarding_completed) {
        setActive(true);
      }
    })();
  }, [user]);

  // Listen for manual restart
  useEffect(() => {
    const handler = () => { setStep(0); setActive(true); };
    window.addEventListener("restart-onboarding", handler);
    return () => window.removeEventListener("restart-onboarding", handler);
  }, []);

  const finish = async () => {
    setActive(false);
    if (user) {
      await (supabase.from as any)("user_settings")
        .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" });
    }
  };

  if (!active || !user) return null;

  const current = STEPS[step];
  const matchesRoute = location.pathname === current.route;

  return (
    <div className="fixed inset-x-4 bottom-20 md:inset-x-auto md:right-6 md:bottom-6 md:w-96 z-[60] animate-in slide-in-from-bottom-5">
      <div className="rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                Step {step + 1} of {STEPS.length}
              </p>
              <button onClick={finish} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="font-heading text-base font-semibold text-foreground">{current.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{current.body}</p>
            {!matchesRoute && (
              <p className="text-[11px] text-primary/70 mt-2">
                Visit <span className="font-mono">{current.route}</span> when ready.
              </p>
            )}
            <div className="flex items-center justify-between mt-4 gap-2">
              <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground text-xs">
                Skip tour
              </Button>
              {step < STEPS.length - 1 ? (
                <Button size="sm" onClick={() => setStep((s) => s + 1)} className="rounded-xl gap-1">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={finish} className="rounded-xl">
                  Got it
                </Button>
              )}
            </div>
            <div className="flex gap-1 mt-3">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-primary" : "bg-secondary"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
