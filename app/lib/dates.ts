// All shop dates are Cape Town time (SAST, no daylight saving).
const TZ = "Africa/Johannesburg";

export function todaySAST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function hourSAST(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now)) % 24;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the given ISO date. */
export function startOfWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const day = iso.slice(0, 10);
  return new Date(day + "T00:00:00Z").toLocaleDateString("en-ZA", { ...opts, timeZone: "UTC" });
}

export function isoInSAST(timestamp: string): string {
  return todaySAST(new Date(timestamp));
}

export function earliestOrderDate(minNoticeDays: number, cutoffHour: number | null, now: Date = new Date()): string {
  let days = minNoticeDays;
  if (cutoffHour !== null && hourSAST(now) >= cutoffHour) days += 1;
  return addDays(todaySAST(now), days);
}
