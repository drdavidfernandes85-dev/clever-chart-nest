import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Filter,
  PlayCircle,
  Radio,
  Search,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import { useWebinars, useCountdown, type Webinar } from "@/hooks/useWebinars";

const WebinarStatusPill = ({ w }: { w: Webinar }) => {
  const { label } = useCountdown(
    w.status === "scheduled" ? w.scheduled_at : null,
  );
  if (w.status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-destructive-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive-foreground" />
        </span>
        Live now
      </span>
    );
  }
  if (w.status === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
        <Clock className="h-3 w-3" /> {label}
      </span>
    );
  }
  if (w.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <PlayCircle className="h-3 w-3" /> Recording
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-destructive">
      Canceled
    </span>
  );
};

const WebinarRow = ({ w }: { w: Webinar }) => {
  const isLive = w.status === "live";
  const isUpcoming = w.status === "scheduled";
  const isEnded = w.status === "ended";

  const ctaHref = isLive
    ? w.stream_url ?? `/webinars/${w.id}`
    : isEnded
      ? w.recording_url ?? "#"
      : `/webinars/${w.id}`;

  const ctaLabel = isLive
    ? "Join Now"
    : isEnded
      ? "Watch recording"
      : "Set reminder";

  return (
    <Card className="group flex flex-col sm:flex-row gap-4 p-4 sm:p-5 hover:border-primary/40 transition-colors">
      <div className="relative flex h-32 sm:h-24 sm:w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
        {w.thumbnail_url ? (
          <img
            src={w.thumbnail_url}
            alt={w.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Video className="h-9 w-9 text-primary/60" />
        )}
        <div className="absolute top-2 left-2">
          <WebinarStatusPill w={w} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-base sm:text-lg font-bold text-foreground line-clamp-1">
          {w.title}
        </h3>
        {w.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {w.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserIcon className="h-3 w-3 text-primary" />
            {w.host_name}
          </span>
          {w.topic && (
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3 text-primary" /> {w.topic}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3 text-primary" />
            {new Date(w.scheduled_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          {w.performance_impact && (
            <Badge
              variant="outline"
              className="rounded-full border-primary/30 bg-primary/10 text-primary text-[10px] gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              {w.performance_impact}
            </Badge>
          )}
        </div>
      </div>

      <div className="sm:self-center shrink-0">
        {isEnded && !w.recording_url ? (
          <Button variant="outline" size="sm" disabled className="rounded-xl">
            No recording yet
          </Button>
        ) : isLive ? (
          <a
            href={ctaHref}
            target={w.stream_url ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground shadow-[0_10px_25px_-8px_hsl(var(--destructive)/0.6)] hover:scale-[1.03] transition-transform"
          >
            <Radio className="h-3.5 w-3.5" />
            {ctaLabel}
          </a>
        ) : isEnded ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            {ctaLabel}
          </a>
        ) : (
          <Link
            to={ctaHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_25px_-8px_hsl(var(--primary)/0.6)] hover:scale-[1.03] transition-transform"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </Card>
  );
};

const Webinars = () => {
  const { items, liveNow, upcoming, past, loading } = useWebinars();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((w) => {
      if (filter === "upcoming" && w.status !== "scheduled" && w.status !== "live")
        return false;
      if (filter === "past" && w.status !== "ended") return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        (w.topic ?? "").toLowerCase().includes(q) ||
        w.host_name.toLowerCase().includes(q) ||
        (w.performance_impact ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO
        title="Live Webinars & Recordings | Elite Live Trading Room"
        description="Join the daily live webinars hosted by INFINOX mentors and rewatch every past session — searchable by date, topic and mentor."
        canonical="https://elitelivetradingroom.com/webinars"
      />

      <header className="sticky top-0 z-40 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
            <Badge variant="secondary" className="rounded-full text-[10px] uppercase tracking-wider gap-1">
              <Sparkles className="h-3 w-3" /> Webinars
            </Badge>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-5xl py-6 sm:py-10 space-y-8">
        {/* Headline */}
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
            Live <span className="text-primary">Webinars</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            Daily live trading rooms hosted by INFINOX mentors. Join live, set reminders,
            or rewatch any past session.
          </p>
        </div>

        {/* Live now / Next up */}
        {(liveNow || upcoming) && (
          <Card
            className={`relative overflow-hidden p-5 sm:p-6 ${
              liveNow ? "border-destructive/50" : "border-primary/40"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    liveNow ? "bg-destructive/15" : "bg-primary/15"
                  }`}
                >
                  <Radio
                    className={`h-6 w-6 ${liveNow ? "text-destructive" : "text-primary"}`}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                      liveNow ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {liveNow ? "Live now" : "Up next"}
                  </p>
                  <p className="font-heading text-base sm:text-lg font-bold text-foreground line-clamp-1">
                    {(liveNow ?? upcoming)!.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(liveNow ?? upcoming)!.host_name} ·{" "}
                    {new Date((liveNow ?? upcoming)!.scheduled_at).toLocaleString(
                      undefined,
                      { dateStyle: "medium", timeStyle: "short" },
                    )}
                  </p>
                </div>
              </div>
              {liveNow ? (
                <a
                  href={liveNow.stream_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-destructive-foreground shadow-[0_15px_35px_-12px_hsl(var(--destructive)/0.6)] hover:scale-[1.02] transition-transform"
                >
                  Join Live
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary">
                  <Clock className="h-4 w-4" /> Reminder set
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by topic, mentor or performance tag…"
              className="pl-9 bg-background/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[160px] bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                <SelectItem value="upcoming">Upcoming & live</SelectItem>
                <SelectItem value="past">Recordings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} of {items.length}
          </p>
        </Card>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading sessions…</div>
        ) : filtered.length === 0 ? (
          <Card className="py-16 text-center">
            <Video className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "No webinars yet. Check back soon — sessions are added daily."
                : "No sessions match your search."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((w) => (
              <WebinarRow key={w.id} w={w} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Webinars;
