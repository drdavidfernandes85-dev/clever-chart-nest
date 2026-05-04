import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Search, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/SEO";

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: string;
  duration: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

const CATEGORIES = ["all", "webinar", "tutorial", "analysis"] as const;

const VideoLibrary = () => {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      const { data } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setVideos(data);
      setLoading(false);
    };
    fetchVideos();
  }, []);

  const filtered = videos.filter((v) => {
    const matchCat = filter === "all" || v.category === filter;
    const matchSearch = !search || v.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const categoryLabels: Record<string, string> = {
    all: t("videos.all"),
    webinar: t("videos.webinar"),
    tutorial: t("videos.tutorial"),
    analysis: t("videos.analysis"),
  };

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <SEO
        title="Video Library | IX Sala de Trading"
        description="On-demand webinars, tutorials and market analysis from IX Sala de Trading mentors."
        canonical="https://elitelivetradingroom.com/videos"
      />
      <div className="container max-w-6xl py-24">
        <div className="mb-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground gap-1">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> {t("nav.home")}</Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground uppercase tracking-tight">
            {t("videos.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("videos.desc")}</p>
        </div>

        {/* Player */}
        {playingId && (
          <div className="mb-8 aspect-video w-full overflow-hidden rounded-2xl border border-border/50">
            <iframe
              src={`https://www.youtube.com/embed/${playingId}?autoplay=1`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video player"
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  filter === c
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {categoryLabels[c]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card px-3 py-1.5 w-full sm:w-auto">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/30 bg-card overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Play className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{t("videos.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((video) => (
              <button
                key={video.id}
                onClick={() => setPlayingId(video.youtube_id)}
                className="group rounded-2xl border border-border/30 bg-card overflow-hidden text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="relative aspect-video bg-secondary">
                  <img
                    src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                    alt={video.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center">
                      <Play className="h-5 w-5 text-primary-foreground fill-primary-foreground" />
                    </div>
                  </div>
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> {video.duration}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{video.title}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-primary uppercase bg-primary/10 rounded-full px-2 py-0.5">
                      {video.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  {video.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{video.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoLibrary;
