import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextWebinarDate, useCountdown } from "@/hooks/useWebinarCountdown";

// ─────────────────────────────────────────────────────────────
// EDITABLE COPY / CONFIG — adjust freely without touching JSX
// ─────────────────────────────────────────────────────────────
const STRIP_CONTENT = {
  line1: "Próximo webinar en vivo",
  timeLabel: "Hoy a las 20:00 (LATAM)",
  subline: "Gestión de riesgo avanzada con mentor verificado",
  reserveLabel: "Reservar lugar",
  reserveHref: "/webinars",
  // Same webinar schedule as the hero bar — keep in sync.
  hourLocal24: 20,
  timezoneOffsetFromUTC: -3,
};

const WebinarUrgencyStrip = () => {
  const target = useMemo(
    () =>
      getNextWebinarDate(
        STRIP_CONTENT.hourLocal24,
        STRIP_CONTENT.timezoneOffsetFromUTC,
      ),
    [],
  );
  const { h, m, s, isLive } = useCountdown(target);

  return (
    <div className="sticky top-16 z-30 border-y border-[#FFCD05]/20 bg-[#0F1115]/95 backdrop-blur-md">
      <div className="container flex flex-col items-stretch gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFCD05]/15 text-[#FFCD05]">
            <Radio className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] sm:text-sm">
              <span className="font-bold text-white">{STRIP_CONTENT.line1}</span>
              <span className="text-white/40" aria-hidden>•</span>
              <span className="text-white/70">{STRIP_CONTENT.timeLabel}</span>
              <span className="text-white/40" aria-hidden>•</span>
              {isLive ? (
                <span className="font-bold uppercase tracking-wider text-[#FFCD05] animate-pulse text-xs">
                  EN VIVO
                </span>
              ) : (
                <span className="font-mono font-bold text-[#FFCD05]">
                  {h}h {String(m).padStart(2, "0")}min
                  <span className="ml-1 text-white/40 text-[11px]">{String(s).padStart(2, "0")}s</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-white/50 leading-tight">
              {STRIP_CONTENT.subline}
            </p>
          </div>
        </div>

        <Button
          asChild
          className="h-9 shrink-0 gap-2 rounded-full bg-[#FFCD05] px-4 text-xs sm:text-sm font-bold text-black hover:bg-[#FFE066]"
        >
          <Link to={STRIP_CONTENT.reserveHref}>
            <CalendarClock className="h-3.5 w-3.5" />
            {STRIP_CONTENT.reserveLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default WebinarUrgencyStrip;
