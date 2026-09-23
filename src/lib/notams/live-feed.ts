/**
 * Live Israeli NOTAM feed — an unofficial republish of the IAA's public
 * NOTAM page (ext.iaa.gov.il/aeroinfo) as a single JSON file, scraped and
 * refreshed every ~10 minutes by github.com/arielf-idra/notam-isr (MIT,
 * hosted for free via raw.githubusercontent.com — CORS-enabled, no key).
 *
 * There is no official public NOTAM API for Israeli airspace — the IAA's
 * own page sits behind bot-management and has no CORS headers, which is
 * exactly why that project exists. This is informational, not a substitute
 * for an official pre-flight briefing (same disclaimer the source repo
 * itself carries) — used here the same way the AIP reference layer is:
 * "never auto-clear, always route to a dispatcher" (see
 * src/lib/geo/live-notams.ts), never a silent pass/fail.
 *
 * Most NOTAMs only ever resolve to a circle (center + radius), not a real
 * polygon — see NOTE below and the source repo's own README for why
 * (multi-vertex boundary NOTAMs aren't parsed into a shape there).
 */

const FEED_URL = "https://raw.githubusercontent.com/arielf-idra/notam-isr/main/notams.json";

export interface LiveNotam {
  id: string;
  location: string;
  airfield: string;
  fromDate: string;
  toDate: string;
  /** Free-text ICAO E) field — the human-readable description. */
  eText: string;
  lowerLimit: string | null;
  upperLimit: string | null;
  /** Best-available point + radius — "e_text" source is more precise than the "q_line" fallback (down to ~1.85km). Never a real polygon — see module doc. */
  position: { lat: number; lon: number; radiusNm: number; source: "e_text" | "q_line" };
  notamType: "N" | "R" | "C";
  replaces: string | null;
}

interface RawFeed {
  generatedAt: string;
  notams: Array<{
    id: string;
    location: string;
    airfield: string;
    fromDate: string;
    toDate: string;
    eText: string;
    lowerLimit: string | null;
    upperLimit: string | null;
    position: { lat: number; lon: number; radiusNm: number; source: "e_text" | "q_line" };
    administrative: boolean;
    notamType: "N" | "R" | "C";
    replaces: string | null;
    qLine: { qcode: string };
  }>;
}

/**
 * ICAO NOTAM Q-code subject (the 2nd-3rd letters of qLine.qcode, e.g.
 * "QWCLW" → "WC") — see FAA Order 7930 Appendix B / ICAO Doc 8126. Only
 * subjects that describe a genuine physical hazard or restriction to
 * airspace are kept; everything else in the live feed (ATS route
 * availability, radio frequency changes, ILS/OCA(H) procedure notes, fuel
 * service, etc.) is real but not something a drone flight needs to avoid —
 * and those informational entries only ever get a Q-line *fallback*
 * position (a rough single point "somewhere in this vicinity", often with
 * a huge multi-NM radius covering an entire FIR corner), which would
 * otherwise flood the map with irrelevant coverage. Confirmed against live
 * data: every entry excluded here had lowerLimit/upperLimit both null
 * (no real floor/ceiling — because there's no physical closure to bound).
 */
const HAZARD_SUBJECTS = new Set([
  // "Navigation Warnings: Airspace Restrictions" (R)
  "RA",
  "RD",
  "RM",
  "RO",
  "RP",
  "RR",
  "RT",
  // "Navigation Warnings: Warnings" (W)
  "WA",
  "WB",
  "WC",
  "WD",
  "WE",
  "WF",
  "WG",
  "WH",
  "WJ",
  "WL",
  "WM",
  "WP",
  "WR",
  "WS",
  "WT",
  "WU",
  "WV",
  "WW",
  "WY",
  "WZ",
  // "Other Information" — obstacle notices matter for low-altitude flight even though they're not a "restriction" subject.
  "OB",
]);

/**
 * Fetches the currently-active NOTAMs that represent a real hazard/
 * restriction to low-altitude flight — see HAZARD_SUBJECTS above.
 * "Administrative" entries are periodic CHECKLIST NOTAMs (a manifest of
 * NOTAM numbers, no geographic scope of their own — see the source repo's
 * README) and are filtered out the same way its own default viewer does.
 *
 * Cached for 5 minutes via Next's fetch cache — close to the source's own
 * ~10-minute refresh cadence without hitting GitHub on every request.
 */
export async function fetchLiveNotams(): Promise<LiveNotam[]> {
  const res = await fetch(FEED_URL, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`notam-isr feed returned ${res.status}`);
  const body = (await res.json()) as RawFeed;

  const now = Date.now();
  return body.notams
    .filter((n) => !n.administrative)
    .filter((n) => HAZARD_SUBJECTS.has(n.qLine.qcode.slice(1, 3)))
    .filter((n) => {
      const from = Date.parse(n.fromDate);
      const to = Date.parse(n.toDate);
      return !Number.isNaN(from) && !Number.isNaN(to) && from <= now && now <= to;
    })
    // Observed live: an occasional entry has position.radiusNm: null (seen
    // on an e_text-sourced "WI 1KM RADIUS..." phrase the source's parser
    // doesn't handle — it only extracts NM-denominated radii). Despite the
    // source's own doc claiming every entry has a plottable radius, this
    // one didn't — and a missing radius here can't be safely guessed at:
    // better to skip a NOTAM we can't size than draw an invented circle
    // that looks as authoritative as a real one.
    .filter((n) => typeof n.position?.radiusNm === "number" && n.position.radiusNm > 0)
    .map((n) => ({
      id: n.id,
      location: n.location,
      airfield: n.airfield,
      fromDate: n.fromDate,
      toDate: n.toDate,
      eText: n.eText,
      lowerLimit: n.lowerLimit,
      upperLimit: n.upperLimit,
      position: n.position,
      notamType: n.notamType,
      replaces: n.replaces,
    }));
}
