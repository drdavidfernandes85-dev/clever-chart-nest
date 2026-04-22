import { useEffect, useState } from "react";
import { Trophy, Flame, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { progressInLevel, xpForNextLevel } from "@/lib/xp";

interface XPState {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
}

const XPBar = () => {
  const { user } = useAuth();
  const [xp, setXp] = useState<XPState | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await (supabase.from as any)("user_xp")
        .select("total_xp, level, current_streak, longest_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setXp(data as XPState);
      } else {
        setXp({ total_xp: 0, level: 1, current_streak: 0, longest_streak: 0 });
      }
    };
    load();

    const channel = supabase
      .channel("xp-self")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_xp", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!xp) return null;

  const progress = progressInLevel(xp.total_xp);
  const target = xpForNextLevel(xp.level);
  const pct = Math.min(100, Math.round((progress / target) * 100));

  return (
    <Card className="p-4 bg-card border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trader Level</p>
            <p className="font-heading text-lg font-bold text-foreground leading-none mt-0.5">Lv. {xp.level}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span className="font-mono">{xp.total_xp.toLocaleString()} XP</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Flame className="h-3.5 w-3.5" />
            <span className="font-mono">{xp.current_streak}d</span>
          </div>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
        {progress} / {target} XP to Lv. {xp.level + 1}
      </p>
    </Card>
  );
};

export default XPBar;
