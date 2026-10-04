/**
 * Some areas on the official CAAI drone map (firing ranges, helicopter-flight
 * areas, the 100-ft area) exist on the weekday edition only — the weekend
 * edition does not carry them. Zones flagged `weekdays_only` are therefore
 * drawn on the map only while it is a weekday, and a flight request is checked
 * against them only if its time window touches a weekday.
 *
 * The weekend is defined in UTC, as the AIP publishes its activity hours:
 * from Friday WEEKEND_STARTS_FRIDAY_UTC_HOUR until Sunday WEEKEND_ENDS_SUNDAY_UTC_HOUR
 * (10:00 UTC Friday = 13:00 Israel summer time, 12:00 in winter; 04:00 UTC Sunday
 * = 07:00 / 06:00). These two hours are NOT yet confirmed against the AIP
 * itself — they are single constants so they can be corrected in one place.
 */
export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";
export const WEEKEND_STARTS_FRIDAY_UTC_HOUR = 10;
export const WEEKEND_ENDS_SUNDAY_UTC_HOUR = 4;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** The longest the weekend can last — any window longer than that must reach a weekday. */
const LONGEST_WEEKEND_MS = (2 * 24 + (24 - WEEKEND_STARTS_FRIDAY_UTC_HOUR) + WEEKEND_ENDS_SUNDAY_UTC_HOUR) * HOUR_MS;

/** True while a weekday-only area is in force at this instant. */
export function isWeekdayEditionAt(instant: Date): boolean {
  const day = instant.getUTCDay(); // 0 = Sunday
  const hour = instant.getUTCHours();
  if (day === 6) return false;
  if (day === 5) return hour < WEEKEND_STARTS_FRIDAY_UTC_HOUR;
  if (day === 0) return hour >= WEEKEND_ENDS_SUNDAY_UTC_HOUR;
  return true;
}

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

/**
 * The next moment after `from` at which the weekday edition starts or stops
 * (the weekend begins Friday, ends Sunday) — "this area comes into force on
 * Sunday 07:00" / "stops on Friday 13:00".
 */
export function nextEditionChange(from: Date): { at: Date; weekdayEditionAfter: boolean } {
  const midnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  for (let d = 0; d <= 8; d++) {
    const day = new Date(midnight + d * DAY_MS);
    const dow = day.getUTCDay();
    if (dow === 5) {
      const at = new Date(day.getTime() + WEEKEND_STARTS_FRIDAY_UTC_HOUR * HOUR_MS);
      if (at > from) return { at, weekdayEditionAfter: false };
    }
    if (dow === 0) {
      const at = new Date(day.getTime() + WEEKEND_ENDS_SUNDAY_UTC_HOUR * HOUR_MS);
      if (at > from) return { at, weekdayEditionAfter: true };
    }
  }
  throw new Error("unreachable: the weekend boundaries repeat every week");
}
