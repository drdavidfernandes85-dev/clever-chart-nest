import { useEffect, useMemo, useState } from "react";
import { Zap, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * DataFlash-style real-time economic news widget.
 * Inspired by app.dataflash.news — Actual / Forecast / Previous / Revision
 * cards for the next upcoming event and the most recent released event,
 * with world clocks (SYD / LON / NYC) and live deviation indicator.
 *
 * Data is sourced from our own `fetch-economic-calendar` edge function
 * (Forex Factory feed), so no external paid account is required.
 */

interface CalendarEvent {
  time: string;
  currency: string;
  impact: "high" | "medium" | "low";
  event: string;
  forecast: string;
  previous: string;
  actual: string;
}

interface ApiEvent extends CalendarEvent {
  /** ISO timestamp injected client-side based on `time` (HH:mm NY) */
  ts?: number;
}

const REFRESH_MS = 30_000;

const fmtClock = (tz: string, d = new Date()) =>
  d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

const fmtSeconds = (d = new Date()) =>
  d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const parseNum = (v: string): number | null => {
  if (!v || v === "—") return null;
  const cleaned = v.replace(/[%,$,]/g, "").replace(/[KMB]$/i, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Convert a HH:mm string (NY time) to today's UTC ms timestamp */
const tsFromNyTime = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  // Build a Date in NY tz: approximate by using offset of Date.now()
  const now = new Date();
  const nyParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = nyParts.find((p) => p.type === "year")?.value;
  const mo = nyParts.find((p) => p.type === "month")?.value;
  const d = nyParts.find((p) => p.type === "day")?.value;
  if (!y || !mo || !d) return 0;
  // Construct ISO assuming NY offset; rough enough for "upcoming/recent" sort
  const iso = `${y}-${mo}-${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`;
  return new Date(iso).getTime();
};

const ImpactDot = ({ impact }: { impact: CalendarEvent["impact"] }) => {
  const cls =
    impact === "high"
      ? "bg-red-500"
      : impact === "medium"
        ? "bg-orange-400"
        : "bg-yellow-400";
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      {impact !== "low" && <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />}
      {impact === "high" && <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />}
    </span>
  );
};

const Cell = ({
  label,
  value,
  delta,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: number | null;
  tone?: "default" | "actual" | "forecast" | "previous" | "revision";
}) => {
  const valueTone =
    tone === "actual"
      ? delta == null
        ? "text-primary"
        : delta > 0
          ? "text-emerald-400"
          : delta < 0
            ? "text-red-400"
            : "text-foreground"
      : tone === "forecast"
        ? "text-orange-300"
        : tone === "previous"
          ? "text-muted-foreground"
          : tone === "revision"
            ? "text-foreground"
            : "text-foreground";

  return (
    <div className="flex flex-col items-center justify-center px-1 py-1.5 text-center min-w-0">
      <div className={`font-mono text-base sm:text-lg font-bold tabular-nums truncate w-full ${valueTone}`}>
        {value || "TBA"}
        {delta != null && tone === "actual" && (
          <span
            className={`ml-1 text-[10px] align-top ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground/80">
        {label}
      </div>
    </div>
  );
};

const EventCard = ({
  ev,
  variant,
}: {
  ev: ApiEvent | null;
  variant: "upcoming" | "recent";
}) => {
  const { t } = useLanguage();
  const actualNum = ev ? parseNum(ev.actual) : null;
  const forecastNum = ev ? parseNum(ev.forecast) : null;
  const delta =
    actualNum != null && forecastNum != null ? actualNum - forecastNum : null;

  if (!ev) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/40 p-4 text-center text-xs text-muted-foreground">
        {variant === "upcoming"
          ? t("dataflash.noUpcoming") || "No upcoming events"
          : t("dataflash.noRecent") || "No recent events"}
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-xl border p-3 transition-all ${
        variant === "upcoming"
          ? "border-primary/30 bg-gradient-to-br from-primary/5 via-card/60 to-card/40 hover:border-primary/50"
          : "border-border/40 bg-card/40 hover:border-border/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary shrink-0">
            {ev.currency}
          </span>
          <ImpactDot impact={ev.impact} />
          <span className="truncate text-xs font-semibold text-foreground">
            {ev.event}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
          {ev.time}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-lg bg-background/40 p-1">
        <Cell
          label={t("dataflash.actual") || "Actual"}
          value={ev.actual}
          delta={delta}
          tone="actual"
        />
        <Cell
          label={t("dataflash.forecast") || "Forecast"}
          value={ev.forecast}
          tone="forecast"
        />
        <Cell
          label={t("dataflash.previous") || "Previous"}
          value={ev.previous}
          tone="previous"
        />
        <Cell
          label={t("dataflash.revision") || "Revision"}
          value="—"
          tone="revision"
        />
      </div>
    </div>
  );
};

const DataFlashWidget = () => {
  const { t } = useLanguage();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(true);
  const [now, setNow] = useState(new Date());

  // Tick clocks every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch + auto-refresh events
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "fetch-economic-calendar",
        );
        if (cancelled) return;
        if (error || !data?.success) {
          setConnected(false);
        } else {
          const list: ApiEvent[] = (data.data as CalendarEvent[]).map((e) => ({
            ...e,
            ts: tsFromNyTime(e.time),
          }));
          setEvents(list);
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const { upcoming, recent } = useMemo(() => {
    const t0 = Date.now();
    const sorted = [...events].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const up = sorted.find((e) => (e.ts || 0) >= t0 && (!e.actual || e.actual === "—")) || null;
    const rec =
      [...sorted].reverse().find((e) => e.actual && e.actual !== "—") || null;
    return { upcoming: up, recent: rec };
  }, [events]);

  // Audio "squawk" on new actual release
  const lastReleaseRef = useState<string | null>(null);
  useEffect(() => {
    if (!recent || muted) return;
    const key = `${recent.event}-${recent.actual}`;
    if (lastReleaseRef[0] === key) return;
    lastReleaseRef[1](key);
    if (lastReleaseRef[0] !== null) {
      try {
        const u = new SpeechSynthesisUtterance(
          `${recent.currency} ${recent.event}. Actual ${recent.actual}. Forecast ${recent.forecast}.`,
        );
        u.rate = 1.1;
        u.volume = 0.8;
        window.speechSynthesis?.speak(u);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent?.event, recent?.actual, muted]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-lg">
      {/* Header — DataFlash branding band */}
      <div className="flex items-center justify-between bg-gradient-to-r from-secondary/70 via-secondary/50 to-secondary/30 px-4 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary fill-primary" />
            <span className="text-xs font-black uppercase tracking-[0.25em] text-foreground">
              Data<span className="text-primary">Flash</span>
            </span>
          </div>
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              {connected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${connected ? "bg-primary" : "bg-muted-foreground"}`}
              />
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-primary">
              {connected ? "Live" : "Offline"}
            </span>
          </span>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Enable squawk" : "Mute squawk"}
          className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/50 px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
        >
          {muted ? (
            <>
              <VolumeX className="h-3 w-3" /> Squawk
            </>
          ) : (
            <>
              <Volume2 className="h-3 w-3 text-primary" /> Squawk
            </>
          )}
        </button>
      </div>

      {/* Clock strip */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-background/30 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1 text-foreground">
          {connected ? (
            <Wifi className="h-3 w-3 text-primary" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {fmtSeconds(now)}
        </span>
        <span>SYD {fmtClock("Australia/Sydney", now)}</span>
        <span>LON {fmtClock("Europe/London", now)}</span>
        <span>NYC {fmtClock("America/New_York", now)}</span>
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/40" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-primary">
              {t("dataflash.upcoming") || "Upcoming Event"}
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/40" />
          </div>
          <EventCard ev={upcoming} variant="upcoming" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              {t("dataflash.recent") || "Recent Release"}
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
          </div>
          <EventCard ev={recent} variant="recent" />
        </div>

        {loading && events.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-4">
            {t("dataflash.loading") || "Loading market data…"}
          </div>
        )}
      </div>

      <div className="border-t border-border/40 bg-background/20 px-4 py-1.5 text-center text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("dataflash.footer") || "Ultra-low latency · Powered by Infinox"}
      </div>
    </div>
  );
};

export default DataFlashWidget;
