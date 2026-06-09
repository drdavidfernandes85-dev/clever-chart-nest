import { useState, useEffect } from "react";

/** Compute the next webinar Date at HOUR:00 in the given UTC offset. */
export function getNextWebinarDate(hourLocal: number, offsetFromUTC: number) {
  const now = new Date();
  // target UTC hour = local hour - offset (offset is negative for LATAM)
  const targetUTCHour = hourLocal - offsetFromUTC;
  const target = new Date(now);
  target.setUTCHours(targetUTCHour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}

/** Hook that ticks down to a target Date. Returns h/m/s and an `isLive` flag. */
export function useCountdown(target: Date) {
  const [diff, setDiff] = useState(() => Math.max(0, target.getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, target.getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s, isLive: diff === 0 };
}
