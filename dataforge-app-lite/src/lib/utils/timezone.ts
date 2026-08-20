// Timezone-aware day/month boundary helpers so DataForge can bucket dates in the
// boss-configured timezone (to match GHL reporting), handling DST correctly.
// All functions return/accept absolute UTC Dates; only the *wall clock* used to
// compute boundaries is in the given IANA timezone.

/** Offset (ms) where localWallClock = utc + offset, for `tz` at instant `date`. */
export function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUTC - date.getTime();
}

/** UTC Date for the local wall-clock y-mo-d h:mi:s in `tz` (mo is 0-based). */
export function zonedTimeToUtc(tz: string, y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date {
  const asUTC = Date.UTC(y, mo, d, h, mi, s);
  const offset = tzOffsetMs(tz, new Date(asUTC));
  const result = new Date(asUTC - offset);
  // One refinement in case the initial guess crossed a DST boundary.
  const offset2 = tzOffsetMs(tz, result);
  return offset2 !== offset ? new Date(asUTC - offset2) : result;
}

/** Wall-clock Y / M (1-based) / D for `date` in `tz`. */
export function partsInTz(tz: string, date: Date): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  return { year: +parts.year, month: +parts.month, day: +parts.day };
}

/** Start of today (00:00 in `tz`) as a UTC Date. */
export function startOfDayInTz(tz: string, date = new Date()): Date {
  const { year, month, day } = partsInTz(tz, date);
  return zonedTimeToUtc(tz, year, month - 1, day);
}

/** Start of the current month (1st 00:00 in `tz`) as a UTC Date. */
export function startOfMonthInTz(tz: string, date = new Date()): Date {
  const { year, month } = partsInTz(tz, date);
  return zonedTimeToUtc(tz, year, month - 1, 1);
}

/** Start of the current week (Monday 00:00 in `tz`) as a UTC Date. */
export function startOfWeekInTz(tz: string, date = new Date()): Date {
  const { year, month, day } = partsInTz(tz, date);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun … 6=Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  return zonedTimeToUtc(tz, year, month - 1, day - daysFromMonday);
}

/** "YYYY-MM-DD" wall-clock date in `tz` (for daily chart bucket keys). */
export function ymdInTz(tz: string, date: Date): string {
  const { year, month, day } = partsInTz(tz, date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Day range [start, nextDayStart) in `tz` for a YYYY-MM-DD string; null if invalid. */
export function dayRangeInTz(tz: string, ymd: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  return { start: zonedTimeToUtc(tz, y, mo, d), end: zonedTimeToUtc(tz, y, mo, d + 1) };
}
