import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  Filter,
  PlayCircle,
  Radio,
  Search,
  User as UserIcon,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface Session {
  id: string;
  title: string;
  host: string;
  topic?: string;
  scheduled_at: string; // ISO
  status: "live" | "scheduled" | "ended";
}

const now = Date.now();
const inHours = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();

const SESSIONS: Session[] = [
  { id: "s1", title: "London Open Live Analysis", host: "Alex T.",  topic: "FX Majors",     scheduled_at: inHours(0.5), status: "live"      },
  { id: "s2", title: "EUR/USD Weekly Outlook",    host: "María G.", topic: "Forex Outlook", scheduled_at: inHours(20),  status: "scheduled" },
  { id: "s3", title: "Risk & Position Sizing Q&A",host: "Jonas K.", topic: "Risk Management", scheduled_at: inHours(48), status: "scheduled" },
  { id: "s4", title: "NY Session Recap",          host: "Alex T.",  topic: "FX Majors",     scheduled_at: inHours(74),  status: "scheduled" },
];

const SessionStatusPill = ({ s }: { s: Session }) => {
  const { t } = useLanguage();
  if (s.status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-destructive-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive-foreground" />
        </span>
        {t("webinars.liveNow")}
      </span>
    );
  }
  if (s.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <PlayCircle className="h-3 w-3" /> {t("webinars.recording")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
      <Clock className="h-3 w-3" /> {t("sessions.upcoming")}
    </span>
  );
};

const SessionRow = ({ s }: { s: Session }) => {
  const { t } = useLanguage();
  const isLive = s.status === "live";
  const ctaLabel = isLive ? t("webinars.joinNow") : t("sessions.remindMe");

  return (
    <Card className="group flex flex-col sm:flex-row gap-4 p-4 sm:p-5 hover:border-primary/40 transition-colors">
      <div className="relative flex h-32 sm:h-24 sm:w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
        <Video className="h-9 w-9 text-primary/60" />
        <div className="absolute top-2 left-2">
          <SessionStatusPill s={s} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-base sm:text-lg font-bold text-foreground line-clamp-1">
          {s.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserIcon className="h-3 w-3 text-primary" />
            {s.host}
          </span>
          {s.topic && (
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3 text-primary" /> {s.topic}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3 w-3 text-primary" />
            {new Date(s.scheduled_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>

      <div className="sm:self-center shrink-0">
        {isLive ? (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground shadow-[0_10px_25px_-8px_hsl(var(--destructive)/0.6)] hover:scale-[1.03] transition-transform"
          >
            <Radio className="h-3.5 w-3.5" />
            {ctaLabel}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_25px_-8px_hsl(var(--primary)/0.6)] hover:scale-[1.03] transition-transform"
          >
            <Clock className="h-3.5 w-3.5" />
            {ctaLabel}
          </button>
        )}
      </div>
    </Card>
  );
};

const UpcomingSessions = () => {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "live">("all");
  const [date, setDate] = useState<Date | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SESSIONS.filter((s) => {
      if (filter === "live" && s.status !== "live") return false;
      const sd = new Date(s.scheduled_at);
      if (filter === "today") {
        const today = new Date();
        if (
          sd.getFullYear() !== today.getFullYear() ||
          sd.getMonth() !== today.getMonth() ||
          sd.getDate() !== today.getDate()
        )
          return false;
      }
      if (date) {
        if (
          sd.getFullYear() !== date.getFullYear() ||
          sd.getMonth() !== date.getMonth() ||
          sd.getDate() !== date.getDate()
        )
          return false;
      }
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        (s.topic ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, filter, date]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-sm sm:text-base font-bold uppercase tracking-widest text-foreground">
            {t("sessions.title")}
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {filtered.length} {t("webinars.countOf")} {SESSIONS.length}
        </span>
      </div>

      {/* Filters — match Webinars filter card */}
      <Card className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("sessions.searchPlaceholder")}
            className="pl-9 bg-background/50"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[180px] justify-start gap-2 bg-background/50 font-normal",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {date ? format(date, "PPP") : (t("sessions.pickDate"))}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => setDate(d ?? undefined)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {date && (
              <div className="border-t border-border/40 p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setDate(undefined)}
                >
                  {t("sessions.clearDate")}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[160px] bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("webinars.allSessions")}</SelectItem>
              <SelectItem value="today">{t("sessions.today")}</SelectItem>
              <SelectItem value="live">{t("webinars.liveNow")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <Video className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("sessions.empty")}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SessionRow key={s.id} s={s} />
          ))}
        </div>
      )}

      {/* Hidden Badge import keeps tree-shaking happy if unused elsewhere */}
      <Badge className="hidden" />
    </section>
  );
};

export default UpcomingSessions;
