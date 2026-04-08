import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Target, ShieldAlert, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import NewSignalForm from "@/components/signals/NewSignalForm";

interface Signal {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  author_id: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  active: { icon: <Clock className="h-3 w-3" />, label: "Active", color: "bg-primary/20 text-primary border-primary/30" },
  hit_tp: { icon: <CheckCircle className="h-3 w-3" />, label: "TP Hit ✅", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  hit_sl: { icon: <XCircle className="h-3 w-3" />, label: "SL Hit ❌", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  cancelled: { icon: <ShieldAlert className="h-3 w-3" />, label: "Cancelled", color: "bg-muted text-muted-foreground border-border" },
};

const TradingSignals = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchSignals = async () => {
      const { data } = await supabase
        .from("trading_signals")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setSignals(data);
      setLoading(false);
    };
    fetchSignals();

    // Realtime
    const channel = supabase
      .channel("signals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "trading_signals" }, () => {
        fetchSignals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeSignals = signals.filter((s) => s.status === "active");
  const closedSignals = signals.filter((s) => s.status !== "active");
  const displayed = tab === "active" ? activeSignals : closedSignals;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-24">
        <div className="mb-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground gap-1">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> {t("nav.home")}</Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground uppercase tracking-tight">
            {t("signals.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("signals.desc")}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setTab("active")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === "active" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t("signals.active")} ({activeSignals.length})
          </button>
          <button
            onClick={() => setTab("closed")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === "closed" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t("signals.closed")} ({closedSignals.length})
          </button>
        </div>

        {/* Signals */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/30 bg-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </div>
                <div className="flex gap-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{t("signals.empty")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map((signal) => {
              const sc = statusConfig[signal.status] || statusConfig.active;
              const isBuy = signal.direction === "buy";

              return (
                <div
                  key={signal.id}
                  className={`rounded-2xl border bg-card p-5 transition-all hover:shadow-md ${
                    signal.status === "active"
                      ? "border-primary/20 hover:border-primary/40"
                      : "border-border/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-heading text-lg font-bold text-foreground">{signal.pair}</span>
                      <Badge
                        className={`text-[10px] font-bold uppercase gap-1 ${
                          isBuy
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        }`}
                        variant="outline"
                      >
                        {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isBuy ? t("signals.buy") : t("signals.sell")}
                      </Badge>
                    </div>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${sc.color}`}>
                      {sc.icon} {sc.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">{t("signals.entry")}</span>
                      <span className="text-sm font-mono font-semibold text-foreground">{Number(signal.entry_price).toFixed(5)}</span>
                    </div>
                    {signal.stop_loss && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">{t("signals.sl")}</span>
                        <span className="text-sm font-mono font-semibold text-red-400">{Number(signal.stop_loss).toFixed(5)}</span>
                      </div>
                    )}
                    {signal.take_profit && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">{t("signals.tp")}</span>
                        <span className="text-sm font-mono font-semibold text-emerald-400">{Number(signal.take_profit).toFixed(5)}</span>
                      </div>
                    )}
                  </div>

                  {signal.notes && (
                    <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/20 pt-3 mt-1">
                      {signal.notes}
                    </p>
                  )}

                  <div className="mt-3 text-[10px] text-muted-foreground">
                    {new Date(signal.created_at).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingSignals;
