import { Calendar, Clock, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

const SESSIONS = [
  { id: "s1", title: "London Open Live Analysis", host: "Alex T.", at: "Today · 08:00 UTC", live: true },
  { id: "s2", title: "EUR/USD Weekly Outlook", host: "María G.", at: "Tomorrow · 14:00 UTC", live: false },
  { id: "s3", title: "Risk & Position Sizing Q&A", host: "Jonas K.", at: "Fri · 16:30 UTC", live: false },
];

const UpcomingSessions = () => {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            {t("sessions.title")}
          </h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t("sessions.quickJoin")}</span>
      </div>
      <ul className="divide-y divide-border/30">
        {SESSIONS.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
              {s.live ? (
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              ) : (
                <Calendar className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{s.title}</p>
              <p className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{s.host}</span>
                <span>•</span>
                <Clock className="h-2.5 w-2.5" />
                <span className="font-mono">{s.at}</span>
              </p>
            </div>
            <Button
              size="sm"
              variant={s.live ? "default" : "outline"}
              className={
                s.live
                  ? "h-7 gap-1 rounded-full bg-primary px-3 text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
                  : "h-7 gap-1 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wider"
              }
            >
              {s.live ? (
                <>
                  <Play className="h-3 w-3 fill-current" /> {t("sessions.joinLive")}
                </>
              ) : (
                t("sessions.remindMe")
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UpcomingSessions;
