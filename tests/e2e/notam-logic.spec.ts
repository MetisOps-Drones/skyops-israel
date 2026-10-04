import { test, expect } from "@playwright/test";
import {
  checkLiveNotamOverlap,
  formatNotamSchedule,
  isNotamActiveNow,
  notamsActivityLabel,
  notamsValidUntilLabel,
  upcomingNotamsAt,
} from "../../src/lib/geo/live-notams";
import type { LiveNotam } from "../../src/lib/notams/live-feed";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const POINT: [number, number] = [34.7266, 31.7623]; // Hatzor

function notam(partial: Partial<LiveNotam> & { fromOffsetMs: number; toOffsetMs: number }): LiveNotam {
  const { fromOffsetMs, toOffsetMs, ...rest } = partial;
  return {
    id: "T0001/26",
    location: "LLLL",
    airfield: "Tel-Aviv FIR",
    fromDate: new Date(Date.now() + fromOffsetMs).toISOString(),
    toDate: new Date(Date.now() + toOffsetMs).toISOString(),
    eText: "UAS ACT WILL TAKE PLACE. AN AREA CLSD FM GND UP TO 2,500FT AMSL.",
    lowerLimit: "GND",
    upperLimit: "2500FT AMSL",
    position: { lat: 31.7623, lon: 34.7266, radiusNm: 2, source: "e_text" },
    notamType: "N",
    replaces: null,
    schedule: null,
    ...rest,
  };
}

test.describe("NOTAM time logic", () => {
  test("active now vs upcoming vs expired", () => {
    expect(isNotamActiveNow(notam({ fromOffsetMs: -HOUR, toOffsetMs: HOUR }))).toBe(true);
    expect(isNotamActiveNow(notam({ fromOffsetMs: HOUR, toOffsetMs: 2 * HOUR }))).toBe(false);
    expect(isNotamActiveNow(notam({ fromOffsetMs: -2 * HOUR, toOffsetMs: -HOUR }))).toBe(false);
  });

  test("with no window only what is in force right now counts", () => {
    const active = notam({ id: "A", fromOffsetMs: -HOUR, toOffsetMs: HOUR });
    const later = notam({ id: "B", fromOffsetMs: DAY, toOffsetMs: 2 * DAY });
    const check = checkLiveNotamOverlap(POINT, [active, later]);
    expect(check.notams.map((n) => n.id)).toEqual(["A"]);
  });

  test("a requested flight window picks up a NOTAM that starts later — and ignores one that doesn't overlap", () => {
    const tomorrow = notam({ id: "TOMORROW", fromOffsetMs: DAY, toOffsetMs: DAY + 5 * HOUR });
    const nextWeek = notam({ id: "NEXTWEEK", fromOffsetMs: 7 * DAY, toOffsetMs: 8 * DAY });
    const expired = notam({ id: "EXPIRED", fromOffsetMs: -3 * DAY, toOffsetMs: -2 * DAY });
    const window = { start: new Date(Date.now() + DAY + HOUR), end: new Date(Date.now() + DAY + 2 * HOUR) };
    const check = checkLiveNotamOverlap(POINT, [tomorrow, nextWeek, expired], window);
    expect(check.notams.map((n) => n.id)).toEqual(["TOMORROW"]);
    // flying today, before it starts: clear
    const today = { start: new Date(Date.now() + HOUR), end: new Date(Date.now() + 2 * HOUR) };
    expect(checkLiveNotamOverlap(POINT, [tomorrow], today).inside).toBe(false);
  });

  test("a NOTAM elsewhere does not count however well the time fits", () => {
    const far = notam({ fromOffsetMs: -HOUR, toOffsetMs: HOUR, position: { lat: 32.9, lon: 35.5, radiusNm: 2, source: "e_text" } });
    expect(checkLiveNotamOverlap(POINT, [far]).inside).toBe(false);
  });

  test("radius edge: just inside counts, just outside doesn't", () => {
    const n = notam({ fromOffsetMs: -HOUR, toOffsetMs: HOUR, position: { lat: 31.7623, lon: 34.7266, radiusNm: 1, source: "e_text" } });
    const inside: [number, number] = [34.7266 + 0.0159, 31.7623]; // ~1.5 km east (< 1.852 km)
    const outside: [number, number] = [34.7266 + 0.0245, 31.7623]; // ~2.3 km east
    expect(checkLiveNotamOverlap(inside, [n]).inside).toBe(true);
    expect(checkLiveNotamOverlap(outside, [n]).inside).toBe(false);
  });

  test("upcoming NOTAMs at a point are sorted and limited to the horizon", () => {
    const soon = notam({ id: "SOON", fromOffsetMs: 2 * DAY, toOffsetMs: 3 * DAY });
    const sooner = notam({ id: "SOONER", fromOffsetMs: DAY, toOffsetMs: 2 * DAY });
    const tooFar = notam({ id: "TOOFAR", fromOffsetMs: 30 * DAY, toOffsetMs: 31 * DAY });
    const active = notam({ id: "ACTIVE", fromOffsetMs: -HOUR, toOffsetMs: HOUR });
    expect(upcomingNotamsAt(POINT, [soon, tooFar, active, sooner], 14).map((n) => n.id)).toEqual(["SOONER", "SOON"]);
  });
});

test.describe("NOTAM expiry and activity hours labels", () => {
  test("valid-until shows the latest end; a years-away end reads as long-term", () => {
    const a = notam({ fromOffsetMs: -HOUR, toOffsetMs: 2 * DAY });
    const b = notam({ fromOffsetMs: -HOUR, toOffsetMs: 5 * DAY });
    expect(notamsValidUntilLabel([a, b])).toBe(notamsValidUntilLabel([b]));
    expect(notamsValidUntilLabel([notam({ fromOffsetMs: -HOUR, toOffsetMs: 3 * 365 * DAY })])).toMatch(/^לטווח ארוך \(עד \d{4}\)$/);
  });

  test('"DAILY 0500-1500" UTC is 08:00–18:00 in summer time and 07:00–17:00 in winter', () => {
    expect(formatNotamSchedule("DAILY 0500-1500", "2026-10-05T05:00:00Z")).toBe("מדי יום 08:00–18:00 (שעון ישראל)");
    expect(formatNotamSchedule("DAILY 0500-1500", "2026-12-01T05:00:00Z")).toBe("מדי יום 07:00–17:00 (שעון ישראל)");
  });

  test("weekday words are translated and unknown text is kept as published", () => {
    expect(formatNotamSchedule("MON-FRI 0600-1400", "2026-07-01T06:00:00Z")).toContain("שני-שישי");
    expect(formatNotamSchedule("SR-SS", "2026-07-01T06:00:00Z")).toBe("SR-SS");
  });

  test("activity label appears only when every overlapping NOTAM publishes the same hours", () => {
    const a = notam({ fromOffsetMs: -HOUR, toOffsetMs: DAY, schedule: "DAILY 0500-1500" });
    const b = notam({ fromOffsetMs: -HOUR, toOffsetMs: DAY, schedule: "DAILY 0500-1500" });
    const c = notam({ fromOffsetMs: -HOUR, toOffsetMs: DAY, schedule: "DAILY 0600-1400" });
    expect(notamsActivityLabel([a, b])).toContain("מדי יום");
    expect(notamsActivityLabel([a, c])).toBeNull();
    expect(notamsActivityLabel([notam({ fromOffsetMs: -HOUR, toOffsetMs: DAY })])).toBeNull();
  });
});

test.describe("live feed sanity (network)", () => {
  test("the public feed is reachable, recent, and carries item D schedules for hazard NOTAMs", async ({ request }) => {
    const res = await request.get("https://raw.githubusercontent.com/arielf-idra/notam-isr/main/notams.json", { timeout: 30_000 });
    test.skip(!res.ok(), `feed unreachable (${res.status()})`);
    const feed = (await res.json()) as { generatedAt: string; notams: { rawText?: string; eText: string; administrative: boolean }[] };
    const ageH = (Date.now() - Date.parse(feed.generatedAt)) / HOUR;
    expect(ageH, `feed generatedAt ${feed.generatedAt}`).toBeLessThan(6);
    const uas = feed.notams.filter((n) => !n.administrative && /UAS/.test(n.eText));
    expect(uas.length).toBeGreaterThan(0);
    const withD = uas.filter((n) => /\bD\)\s*\S/.test(n.rawText ?? ""));
    expect(withD.length).toBeGreaterThan(0);
  });
});
