import { useState } from "react";
import { Video, Play, Clock, Calendar, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const PAST_RECORDINGS = [
  {
    id: "1",
    title: "EUR/USD Weekly Outlook — Key Levels & Trade Setups",
    date: "2026-04-04",
    duration: "1h 12m",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    youtubeId: "dQw4w9WgXcQ",
    views: 342,
  },
  {
    id: "2",
    title: "NFP Aftermath: How to Trade the Dollar This Week",
    date: "2026-04-03",
    duration: "58m",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    youtubeId: "dQw4w9WgXcQ",
    views: 518,
  },
  {
    id: "3",
    title: "Gold & Oil Analysis — Geopolitical Risk Premium",
    date: "2026-04-02",
    duration: "1h 05m",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    youtubeId: "dQw4w9WgXcQ",
    views: 276,
  },
  {
    id: "4",
    title: "Live Q&A: Risk Management & Position Sizing",
    date: "2026-04-01",
    duration: "45m",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    youtubeId: "dQw4w9WgXcQ",
    views: 189,
  },
  {
    id: "5",
    title: "GBP Pairs Deep Dive — BOE Rate Decision Preview",
    date: "2026-03-31",
    duration: "1h 20m",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    youtubeId: "dQw4w9WgXcQ",
    views: 401,
  },
];

const LiveWebinarTab = () => {
  const LIVE_STREAM_ID = "";

  return (
    <div className="p-4">
      {LIVE_STREAM_ID ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/50">
          <iframe
            src={`https://www.youtube.com/embed/${LIVE_STREAM_ID}?autoplay=1`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Live Webinar"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-secondary/20 py-16 px-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-1">No Live Webinar Right Now</h4>
          <p className="text-xs text-muted-foreground max-w-xs mb-4">
            Daily webinars are held every trading day. Check the schedule below or join the chatroom for updates.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2.5">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">Next Session</p>
                <p className="text-[10px] text-muted-foreground">Tomorrow, 09:00 UTC</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2.5">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">Duration</p>
                <p className="text-[10px] text-muted-foreground">~60 min daily</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RecordingsTab = () => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <div className="p-4 space-y-3">
      {playingId && (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/50 mb-4">
          <iframe
            src={`https://www.youtube.com/embed/${playingId}?autoplay=1`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Recording"
          />
        </div>
      )}

      <div className="space-y-2">
        {PAST_RECORDINGS.map((rec) => (
          <button
            key={rec.id}
            onClick={() => setPlayingId(rec.youtubeId === playingId ? null : rec.youtubeId)}
            className="flex w-full items-start gap-3 rounded-xl border border-border/30 bg-card/60 p-3 text-left transition-all duration-300 hover:bg-secondary/50 hover:border-primary/20"
          >
            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-secondary">
              <img
                src={rec.thumbnail}
                alt={rec.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Play className="h-5 w-5 text-foreground fill-foreground" />
              </div>
              <span className="absolute bottom-0.5 right-0.5 rounded-md bg-background/80 px-1 py-0.5 text-[9px] font-mono text-foreground">
                {rec.duration}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{rec.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="text-[10px] text-muted-foreground">•</span>
                <span className="text-[10px] text-muted-foreground">{rec.views} views</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const WebinarWidget = () => {
  const tabTriggerClass =
    "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-2";

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <Tabs defaultValue="live" className="w-full">
        <div className="flex items-center justify-between border-b border-border/50 bg-secondary/30 px-2">
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="live" className={tabTriggerClass}>
              <Video className="h-3.5 w-3.5" />
              LIVE WEBINAR
            </TabsTrigger>
            <TabsTrigger value="recordings" className={tabTriggerClass}>
              <Play className="h-3.5 w-3.5" />
              RECORDINGS
            </TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 text-primary border-primary/30 rounded-lg">
            Daily Sessions
          </Badge>
        </div>

        <TabsContent value="live" className="mt-0">
          <LiveWebinarTab />
        </TabsContent>
        <TabsContent value="recordings" className="mt-0">
          <RecordingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebinarWidget;
