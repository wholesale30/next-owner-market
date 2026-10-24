/**
 * Eastern-time helpers for the owner's posting schedule (Oct 24, 2026). The server runs in UTC, so "today"
 * and "7 AM" have to be worked out in America/New_York, or the day would reset at 8 PM his time.
 */
const TZ = "America/New_York";

/** Minutes since midnight, Eastern time. */
export function etMinutes(d = new Date()): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const h = Number(p.find((x) => x.type === "hour")?.value || 0) % 24;
  const m = Number(p.find((x) => x.type === "minute")?.value || 0);
  return h * 60 + m;
}

/** The moment Eastern-time midnight started today. */
export function etStartOfDay(d = new Date()): Date {
  return new Date(d.getTime() - etMinutes(d) * 60000 - d.getSeconds() * 1000 - d.getMilliseconds());
}

/** If now is outside [startHour, endHour) Eastern, when the next start is; otherwise null. */
export function etNextOpen(startHour: number, endHour: number, d = new Date()): Date | null {
  const now = etMinutes(d), open = startHour * 60, close = endHour * 60;
  if (now >= open && now < close) return null;
  const wait = (open - now + 1440) % 1440;
  return new Date(d.getTime() + wait * 60000 - d.getSeconds() * 1000);
}
