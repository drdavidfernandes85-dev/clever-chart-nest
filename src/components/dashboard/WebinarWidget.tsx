import { useState, useEffect } from "react";
import { Video, Play, Clock, Calendar, Settings2, X, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

/** Parse a YouTube URL/ID into an embed-ready video ID */
function parseYoutubeId(input: string): string | null {
  if (!input) return null;
  // Already a plain ID
  if (/^[\w-]{11}$/.test(input.trim())) return input.trim();
  // Various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Parse a Zoom meeting URL into meeting number + password */
function parseZoomUrl(input: string): { meetingNumber: string; password?: string } | null {
  if (!input) return null;
  const m = input.match(/zoom\.us\/j\/(\d+)(?:\?pwd=(\w+))?/);
  if (m) return { meetingNumber: m[1], password: m[2] };
  // Just a meeting number
  if (/^\d{9,11}$/.test(input.trim())) return { meetingNumber: input.trim() };
  return null;
}

type LiveSource = {
  type: "youtube" | "zoom" | "none";
  url: string;
};

const SETTING_KEY = "live_webinar_source";

/** Save live source to DB */
async function saveLiveSourceToDB(source: LiveSource) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: SETTING_KEY, value: source as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) console.error("Failed to save live source", error);
}

const LiveWebinarTab = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [liveSource, setLiveSource] = useState<LiveSource>({ type: "none", url: "" });
  const [inputUrl, setInputUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"])
      .then(({ data }) => setIsAdmin(!!(data && data.length > 0)));
  }, [user]);

  // Load from DB + subscribe to realtime changes
  useEffect(() => {
    // Initial fetch
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const src = data.value as unknown as LiveSource;
          setLiveSource(src);
          setInputUrl(src.url);
        }
      });

    // Realtime subscription
    const channel = supabase
      .channel("live-webinar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: `key=eq.${SETTING_KEY}` },
        (payload: any) => {
          const newVal = payload.new?.value as LiveSource | undefined;
          if (newVal) {
            setLiveSource(newVal);
            setInputUrl(newVal.url);
          } else {
            setLiveSource({ type: "none", url: "" });
            setInputUrl("");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSetLive = async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      const source: LiveSource = { type: "none", url: "" };
      setLiveSource(source);
      await saveLiveSourceToDB(source);
      toast.success("Live stream cleared");
      setShowSettings(false);
      return;
    }

    const ytId = parseYoutubeId(trimmed);
    if (ytId) {
      const source: LiveSource = { type: "youtube", url: ytId };
      setLiveSource(source);
      await saveLiveSourceToDB(source);
      toast.success("YouTube live stream set!");
      setShowSettings(false);
      return;
    }

    const zoom = parseZoomUrl(trimmed);
    if (zoom) {
      const source: LiveSource = { type: "zoom", url: trimmed };
      setLiveSource(source);
      await saveLiveSourceToDB(source);
      toast.success("Zoom meeting link set!");
      setShowSettings(false);
      return;
    }

    toast.error("Paste a YouTube URL/ID or Zoom meeting link");
  };

  const handleStopLive = async () => {
    const source: LiveSource = { type: "none", url: "" };
    setLiveSource(source);
    setInputUrl("");
    await saveLiveSourceToDB(source);
    toast.success("Live stream ended");
  };

  return (
    <div className="p-4">
      {/* Admin controls */}
      {isAdmin && (
        <div className="mb-3">
          {showSettings ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground uppercase">Set Live Stream</Label>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                placeholder="YouTube URL/ID or Zoom meeting link"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Examples: youtube.com/watch?v=xxx, youtu.be/xxx, zoom.us/j/123456789
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSetLive} className="rounded-full text-xs">
                  Go Live
                </Button>
                {liveSource.type !== "none" && (
                  <Button size="sm" variant="destructive" onClick={handleStopLive} className="rounded-full text-xs">
                    Stop Live
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="gap-1.5 text-[10px] text-muted-foreground"
            >
              <Settings2 className="h-3 w-3" /> {liveSource.type !== "none" ? "Change Stream" : "Start Live Stream"}
            </Button>
          )}
        </div>
      )}

      {/* Live stream display */}
      {liveSource.type === "youtube" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-red-500 text-white border-0 gap-1 text-[10px] animate-pulse">
              <Radio className="h-3 w-3" /> LIVE
            </Badge>
            <span className="text-xs text-muted-foreground">YouTube Live Stream</span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/50">
                <iframe
                  src={`https://www.youtube.com/embed/${liveSource.url}?autoplay=1`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Live Webinar"
                />
              </div>
            </div>
            <div className="w-72 shrink-0 rounded-xl border border-border/50 overflow-hidden h-[360px]">
              <WebinarChat />
            </div>
          </div>
        </div>
      )}

      {liveSource.type === "zoom" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-blue-500 text-white border-0 gap-1 text-[10px] animate-pulse">
              <Radio className="h-3 w-3" /> LIVE
            </Badge>
            <span className="text-xs text-muted-foreground">Zoom Meeting</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/5 py-12 px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
              <Video className="h-8 w-8 text-blue-400" />
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Zoom Meeting is Live</h4>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Click below to join the live trading session on Zoom.
            </p>
            <Button
              asChild
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 gap-2"
            >
              <a href={liveSource.url.startsWith("http") ? liveSource.url : `https://zoom.us/j/${liveSource.url}`} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4" /> Join Zoom Meeting
              </a>
            </Button>
          </div>
        </div>
      )}

      {liveSource.type === "none" && (
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
