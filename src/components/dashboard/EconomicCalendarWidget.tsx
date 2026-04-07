import { useEffect, useState } from "react";
import { Calendar, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EconomicEvent {
  time: string;
  currency: string;
  event: string;
  impact: "high" | "medium" | "low";
  forecast?: string;
  previous?: string;
}

const impactColors = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const EconomicCalendarWidget = () => {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-economic-calendar");
        if (!error && data?.events) {
          setEvents(data.events.slice(0, 8));
          setLoading(false);
          return;
        }
      } catch {}
      // Fallback
      setEvents([
        { time: "08:30", currency: "USD", event: "Non-Farm Payrolls", impact: "high", forecast: "200K", previous: "187K" },
        { time: "10:00", currency: "USD", event: "ISM Services PMI", impact: "high", forecast: "52.3", previous: "51.4" },
        { time: "08:30", currency: "USD", event: "Unemployment Rate", impact: "high", forecast: "3.8%", previous: "3.9%" },
        { time: "14:00", currency: "EUR", event: "ECB Rate Decision", impact: "high", forecast: "4.50%", previous: "4.50%" },
        { time: "09:45", currency: "GBP", event: "UK Services PMI", impact: "medium", forecast: "53.8", previous: "53.4" },
        { time: "19:00", currency: "USD", event: "FOMC Minutes", impact: "medium" },
      ]);
      setLoading(false);
    };
    fetchCalendar();
  }, []);

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wide">Economic Calendar</h3>
      </div>

      <div className="divide-y divide-border/20">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No upcoming events</div>
        ) : (
          events.map((ev, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-14 shrink-0">
                <Clock className="h-3 w-3" />
                {ev.time}
              </div>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground w-8 text-center shrink-0">
                {ev.currency}
              </span>
              <span className="flex-1 text-xs text-foreground truncate">{ev.event}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${impactColors[ev.impact]}`}>
                {ev.impact === "high" && <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5" />}
                {ev.impact}
              </span>
              {ev.forecast && (
                <span className="text-[10px] text-muted-foreground w-16 text-right shrink-0">
                  F: {ev.forecast}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EconomicCalendarWidget;
