# Metisim — handoff (2026-10-04)

Where the work stands, so it can be continued from another machine. Everything below is committed and pushed;
`git pull` and you have it all.

## Setup on a new machine
- `npm install`, copy `.env.local` (Supabase URL/keys, Mapbox, `E2E_HOBBY_EMAIL/PASSWORD`, optional `SUPABASE_SERVICE_ROLE_KEY` — the audit specs read production **read-only** with it).
- `npm run dev`, then `npx playwright test --workers=2` (the config pins 2 workers: more makes the UI specs race on the one dev server and the one hobby account).
- Windows PowerShell blocks `npx.ps1` by default: use `npx.cmd`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Hebrew text edits: never through PowerShell string replace on files with Hebrew (it garbles); use an editor/Edit tool. `.NET` `WriteAllLines` writes CRLF — the repo is LF.

## Migrations
Run by hand in the Supabase SQL editor (idempotent, safe to re-run). Latest run: **0095**.
- **0096_flight_request_infrastructure_declaration.sql — NOT RUN YET.** Adds `flight_requests.infrastructure_declaration`. The app only writes the column when a pilot uses the declaration, so everything else works without it.
- 0093 weekday-only zones (ranges, helicopter areas, 100-ft area; `weekdays_only`, `drone_max_altitude_m`, `note`), 0094 official CAAI geometry (18 outlines replaced, 10 control-zone polygons added), 0095 Eilat-Ramon authority location.

## What was built in this stretch
- Zone rules: runway distance 2 km / 3 km (military, commercial), CTR/ATZ = coordination, prohibited = forbidden, dangerous = director approval (orgs). `lib/geo/flight-rules.ts`.
- Weekday/weekend: weekend = Friday 10:00 UTC → Sunday 04:00 UTC (`lib/geo/weekday-zones.ts`). **Not confirmed against the AIP (ENR 5.1)** — two constants.
- Height-limited areas (helicopter 60 m, 100-ft 30 m) = a ceiling for every account, not coordination. **Their legal meaning is inferred** from the official KMZ legend; verify.
- Location card briefing for a chosen time (`lib/geo/location-briefing.ts`), top bar shares the card's verdict (`lib/geo/location-status.ts`), request form leads with the verdict.
- Sport/leisure pilot near a building (`lib/geo/infrastructure-rule.ts`): not blocked; declares owner consent (→ dispatcher) or a micro drone ≤ 250 g under the regulation's conditions (→ may be approved at once).
- Data scripts to regenerate/extend zone data: `scripts/zone-data/` (see its README).

## Open decisions / to verify
1. Weekend hours (above) and what the helicopter / 100-ft areas legally mean.
2. Eilat old airport (LLET) and Mitzpe Ramon (LLMR): no coordination authority — the owner is checking manually.
3. Phone list received from the user: 46 new numbers (military command coordinators, airfield towers, nature reserves…). Proposal: add the ~40 organisational ones, marked "not verified", skip 5 private individuals' mobiles and two ambiguous numbers (08-9905283 listed for two bodies, 03-9774555). Awaiting a yes.
4. UI audit leftovers: search box keyboard (arrows/Enter/Escape) and result relevance, tiny text on desktop (root 12 px) and 29–36 px touch targets, layers-menu accessibility, legend (says "every 10 min", real refresh 5; no entry for weekday zones), mobile card covers the map, pin mode doesn't exit on Escape, geolocation toast contradicts a granted permission (verify on a real device), polygon NOTAM drawing not audited.
5. Known data defect: LLD42 max altitude −530 ft (listed in `airspace-rules.spec.ts`). Heliports: kept as small ATZ radii, no runway rule.
