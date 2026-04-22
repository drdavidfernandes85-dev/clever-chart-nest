import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SharedSignal = {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  status: string;
  created_at: string;
};

const PLACEHOLDERS: SharedSignal[] = [
  { id: "p1", pair: "EUR/USD", direction: "buy", entry_price: 1.1699, status: "hit_tp", created_at: "" },
  { id: "p2", pair: "GBP/JPY", direction: "sell", entry_price: 192.34, status: "open", created_at: "" },
  { id: "p3", pair: "XAU/USD", direction: "buy", entry_price: 2412.5, status: "open", created_at: "" },
  { id: "p4", pair: "USD/JPY", direction: "sell", entry_price: 154.82, status: "open", created_at: "" },
];

const LiveSharedSignals = () => {
  const [signals, setSignals] = useState<SharedSignal[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trading_signals")
        .select("id, pair, direction, entry_price, status, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (!cancelled && data) setSignals(data as SharedSignal[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = (signals.length ? signals : PLACEHOLDERS).slice(0, 6);

  return (
    <div className="rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Live Shared Signals
          </h3>
        </div>
        <Link to="/signals" className="font-proxima text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline">
          All
        </Link>
      </div>
      <ul className="divide-y divide-border/30">
        {rows.map((s) => {
          const isBuy = s.direction.toLowerCase() === "buy";
          return (
            <li key={s.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                {isBuy ? (
                  <TrendingUp className="h-4 w-4 text-[hsl(145_65%_50%)]" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-[hsl(0_70%_55%)]" />
                )}
                <div>
                  <p className="font-mono text-xs font-bold text-foreground">{s.pair}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.direction}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs tabular-nums text-foreground">
                  {Number(s.entry_price).toFixed(s.pair.includes("JPY") ? 2 : 4)}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                  {s.status.replace("_", " ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LiveSharedSignals;
