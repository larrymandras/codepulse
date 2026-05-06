/**
 * Parse day-of-week strings (3-letter abbrevs, ranges, "daily", "*") into
 * Monday-first day indices (0=Mon .. 6=Sun).
 *
 * Shared between CronCalendarView and Operations page metric.
 */

const DAY_MAP: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

/**
 * Convert a days-of-week string into an array of day indices (0=Mon..6=Sun).
 *
 * Supported formats:
 *  - "daily" / "*"          -> [0,1,2,3,4,5,6]
 *  - "mon-fri"              -> [0,1,2,3,4]
 *  - "mon,wed,fri"          -> [0,2,4]
 *  - "tue"                  -> [1]
 */
export function parseDays(days: string): number[] {
  const lower = days.trim().toLowerCase();
  if (lower === "daily" || lower === "*") return [0, 1, 2, 3, 4, 5, 6];

  if (lower.includes("-")) {
    const [start, end] = lower.split("-").map((d) => DAY_MAP[d.trim()]);
    if (start !== undefined && end !== undefined) {
      const result: number[] = [];
      for (let i = start; i <= (end >= start ? end : end + 7); i++) {
        result.push(i % 7);
      }
      return result;
    }
  }

  return lower
    .split(",")
    .map((d) => DAY_MAP[d.trim()])
    .filter((d): d is number => d !== undefined);
}

/**
 * Return today's Monday-first day index (0=Mon..6=Sun).
 * JS getDay() returns 0=Sun, so we remap: Sun(0)->6, Mon(1)->0, etc.
 */
export function todayDayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}
