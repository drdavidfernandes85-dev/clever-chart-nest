import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Circle } from "lucide-react";

interface OnlineUser {
  user_id: string;
  display_name: string;
  role?: "admin" | "moderator" | null;
  status: "online" | "trading" | "away";
}

const STATUS_COLORS: Record<OnlineUser["status"], string> = {
  online: "text-[hsl(145_65%_50%)]",
  trading: "text-primary",
  away: "text-muted-foreground/60",
};

const initials = (n: string) =>
  n
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "TR";

const colorFor = (id: string) => {
  const palette = [
    "bg-teal-600/30 text-teal-300",
    "bg-blue-600/30 text-blue-300",
    "bg-indigo-600/30 text-indigo-300",
    "bg-purple-600/30 text-purple-300",
    "bg-orange-600/30 text-orange-300",
    "bg-pink-600/30 text-pink-300",
    "bg-cyan-600/30 text-cyan-300",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

/**
 * Online Traders list — displayed inside the left sidebar of the Community Hub.
 * Lightweight: fetches recent profiles + roles, simulates online/trading status.
 */
const OnlineTraders = () => {
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (cancelled || !profs) return;

      const roleMap = new Map<string, "admin" | "moderator">();
      roles?.forEach((r) => {
        if (r.role === "admin" || r.role === "moderator")
          roleMap.set(r.user_id, r.role);
      });

      const next: OnlineUser[] = profs.map((p, idx) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        role: roleMap.get(p.user_id) ?? null,
        // Simulated status — real presence would come from supabase realtime presence
        status: idx < 6 ? "online" : idx < 12 ? "trading" : "away",
      }));
      setUsers(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = {
    online: users.filter((u) => u.status === "online"),
    trading: users.filter((u) => u.status === "trading"),
    away: users.filter((u) => u.status === "away"),
  };

  const renderGroup = (label: string, list: OnlineUser[]) => {
    if (!list.length) return null;
    return (
      <div className="mb-2">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label} — {list.length}
        </p>
        <ul className="space-y-0.5">
          {list.map((u) => (
            <li
              key={u.user_id}
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-secondary/50 cursor-pointer transition-colors"
            >
              <div className="relative">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${colorFor(
                    u.user_id,
                  )}`}
                >
                  {initials(u.display_name)}
                </div>
                <Circle
                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 fill-current ${STATUS_COLORS[u.status]}`}
                  strokeWidth={0}
                />
              </div>
              <span className="truncate text-xs text-foreground/90 flex-1">
                {u.display_name}
              </span>
              {u.role && (
                <span
                  className={`rounded-sm px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider ${
                    u.role === "admin"
                      ? "bg-primary/20 text-primary"
                      : "bg-primary/10 text-primary/80"
                  }`}
                >
                  {u.role === "admin" ? "ADM" : "MOD"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="px-1">
      {renderGroup("Online", grouped.online)}
      {renderGroup("Trading", grouped.trading)}
      {renderGroup("Away", grouped.away)}
    </div>
  );
};

export default OnlineTraders;
