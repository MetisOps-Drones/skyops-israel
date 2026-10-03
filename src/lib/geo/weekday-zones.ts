/**
 * Some areas on the official CAAI drone map (firing ranges, helicopter-flight
 * areas, the 100-ft area) exist on the weekday edition only — the weekend
 * edition does not carry them. Zones flagged `weekdays_only` are therefore
 * drawn on the map only while it is a weekday in Israel, and a flight request
 * is checked against them only if its time window touches a weekday.
 *
 * Israel's weekend: Friday from WEEKEND_STARTS_FRIDAY_HOUR through Saturday
 * night. The 13:00 start is NOT confirmed against the CAAI publication —
 * it's a single constant so it can be corrected in one place.
 */
export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";
export const WEEKEND_STARTS_FRIDAY_HOUR = 13;

const israelClock = new Intl.DateTimeFormat("en-US", {
  timeZone: ISRAEL_TIME_ZONE,
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

/** True while a weekday-only area is in force at this instant (Sunday to Friday midday, Israel time). */
export function isWeekdayEditionAt(instant: Date): boolean {
  const parts = israelClock.formatToParts(instant);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  if (weekday === "Sat") return false;
  if (weekday === "Fri") return hour < WEEKEND_STARTS_FRIDAY_HOUR;
  return true;
}

const HOUR_MS = 60 * 60 * 1000;
/** The weekend lasts under 36 h, so any window longer than that must reach a weekday. */
const LONGEST_WEEKEND_MS = 36 * HOUR_MS;

/**
 * Whether a weekday-only area applies to a flight window: true if any moment
 * of it falls on the weekday edition. With no window (a point inspected on
 * the map before a time is chosen) it is judged at `now`.
 */
export function weekdayEditionAppliesTo(window: { start: Date; end: Date } | null | undefined, now: Date = new Date()): boolean {
  if (!window) return isWeekdayEditionAt(now);
  const start = window.start.getTime();
  const end = window.end.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  if (end - start > LONGEST_WEEKEND_MS) return true;
  for (let t = start; t < end; t += HOUR_MS) {
    if (isWeekdayEditionAt(new Date(t))) return true;
  }
  return isWeekdayEditionAt(new Date(end));
}

/** A zone is in force for the given window/now unless it is weekday-only and the window sits wholly on the weekend. */
export function zoneIsInForce(
  zone: { weekdays_only?: boolean | null },
  window?: { start: Date; end: Date } | null,
  now: Date = new Date()
): boolean {
  return !zone.weekdays_only || weekdayEditionAppliesTo(window, now);
}
