import { useState, useEffect, useCallback } from "react";
import { Calendar, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CalendarEvent {
  time: string;
  currency: string;
  impact: "high" | "medium" | "low";
  event: string;
  forecast: string;
  previous: string;
  actual: string;
}

const impactColor = {
  high: "bg-red-500",
  medium: "bg-orange-400",
  low: "bg-yellow-400",
};

const EconomicCalendarWidget = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-economic-calendar");
      if (!error && data?.data && data.data.length > 0) {
        setEvents(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch calendar:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
    const interval = setInterval(fetchCalendar, 300000);
    return () => clearInterval(interval);
  }, [fetchCalendar]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between bg-secondary/50 px-4 py-2 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">Economic Calendar</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Powered by <span className="font-bold text-primary">LIVESQUAWK</span></span>
      </div>

      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/20">
        <span className="text-xs font-semibold text-foreground">{dateStr}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">investing.com</span>
          <button onClick={fetchCalendar} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-border px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="text-[10px] text-muted-foreground">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          <span className="text-[10px] text-muted-foreground">Low</span>
        </div>
      </div>

      <div className="grid grid-cols-[50px_40px_20px_1fr_55px_55px_55px] gap-1 border-b border-border px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
        <span>Time</span>
        <span>Cur.</span>
        <span></span>
        <span>Event</span>
        <span className="text-right">Forecast</span>
        <span className="text-right">Previous</span>
        <span className="text-right">Actual</span>
      </div>

      <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
        {loading && events.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No calendar events available
          </div>
        ) : (
          events.map((evt, i) => (
            <div key={i} className="grid grid-cols-[50px_40px_20px_1fr_55px_55px_55px] gap-1 items-center px-4 py-2 hover:bg-muted/20 transition-colors">
              <span className="text-[11px] font-mono text-muted-foreground">{evt.time}</span>
              <span className="text-[11px] font-semibold text-foreground">{evt.currency}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${impactColor[evt.impact] || impactColor.medium}`} />
              <span className="text-xs text-foreground truncate">{evt.event}</span>
              <span className="text-[11px] text-right font-mono text-muted-foreground">{evt.forecast}</span>
              <span className="text-[11px] text-right font-mono text-muted-foreground">{evt.previous}</span>
              <span className={`text-[11px] text-right font-mono ${evt.actual !== "—" ? "text-foreground font-semibold" : "text-muted-foreground/50"}`}>{evt.actual}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EconomicCalendarWidget;
