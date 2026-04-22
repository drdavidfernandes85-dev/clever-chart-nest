import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as Icons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  earned: boolean;
  earned_at?: string;
}

const tierColor: Record<string, string> = {
  bronze: "from-orange-500/20 to-orange-700/10 text-orange-400 border-orange-500/30",
  silver: "from-slate-300/20 to-slate-500/10 text-slate-300 border-slate-400/30",
  gold: "from-primary/30 to-primary/10 text-primary border-primary/40",
};

const BadgeShelf = () => {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: all }, { data: mine }] = await Promise.all([
        (supabase.from as any)("badges").select("*").order("xp_reward", { ascending: true }),
        (supabase.from as any)("user_badges").select("badge_id, earned_at").eq("user_id", user.id),
      ]);
      const earnedMap = new Map<string, string>(
        (mine ?? []).map((b: any) => [b.badge_id as string, b.earned_at as string])
      );
      setBadges(
        (all ?? []).map((b: any) => ({
          ...b,
          earned: earnedMap.has(b.id),
          earned_at: earnedMap.get(b.id),
        }))
      );
    };
    load();
  }, [user]);

  return (
    <Card className="p-5 bg-card border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Achievements</p>
          <h3 className="font-heading text-lg font-semibold text-foreground mt-1">Badge Collection</h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {badges.filter((b) => b.earned).length}/{badges.length}
        </span>
      </div>
      <TooltipProvider>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {badges.map((b) => {
            const Icon = (Icons as any)[b.icon] ?? Icons.Award;
            const tone = tierColor[b.tier] ?? tierColor.bronze;
            return (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`aspect-square rounded-2xl border bg-gradient-to-br ${tone} flex items-center justify-center transition-all ${
                      b.earned ? "" : "opacity-25 grayscale"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="font-semibold text-xs">{b.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{b.description}</p>
                  {!b.earned && <p className="text-[10px] mt-1 text-primary">Locked</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </Card>
  );
};

export default BadgeShelf;
