export function getTodayISOInTurkey(now = new Date()): string {
  // YYYY-MM-DD in Turkey time zone
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseTRTimeHHMM(timeTR: string): { h: number; m: number } | null {
  const parts = String(timeTR).trim().split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function buildDateAssumingTurkeyUTCPlus3(
  timeTR: string,
  now = new Date(),
): Date | null {
  const hm = parseTRTimeHHMM(timeTR);
  if (!hm) return null;

  const todayISO_TR = getTodayISOInTurkey(now);
  const iso = `${todayISO_TR}T${String(hm.h).padStart(2, "0")}:${String(hm.m).padStart(2, "0")}:00+03:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getGMTOffsetLabel(now = new Date()): string {
  const offsetMinutes = now.getTimezoneOffset(); // e.g. TR => -180
  const offsetHours = -offsetMinutes / 60;
  const str =
    offsetHours % 1 === 0
      ? String(offsetHours)
      : offsetHours.toFixed(1).replace(/\.0$/, "");
  return `GMT${offsetHours >= 0 ? "+" : ""}${str}`;
}

