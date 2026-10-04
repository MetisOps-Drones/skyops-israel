# Zone data scripts

Node scripts (CommonJS) used to build the zone migrations from official sources. Run from the repo root, e.g.
`node scripts/zone-data/gen-0094.cjs <doc.kml> <out.sql>`.

- `kml-parse.cjs` — parses the official CAAI drone-map KMZ (unzip it first; the `doc.kml` inside). Layer order in the file: settlements, air-force bases, ranges, helicopter areas, 100-ft area, prohibited areas, general airspace.
- `gen-wk.cjs <weekdays doc.kml> <out.sql>` — the weekday-only layers (migration 0093).
- `gen-0094.cjs <weekdays doc.kml> <out.sql>` — compares the official outlines with `aip_reference_zones` and writes the geometry migration (0094). Reads production with the service key from `.env.local`.
- `dbzones.cjs` — tiny read-only Supabase REST helper (`q("table?select=*")`), service key from `.env.local`.
- `fetch-runways.cjs`, `gen-runways.cjs` — OpenStreetMap runways → `src/lib/geo/aerodrome-runways.ts`.

The official KMZ files are not in the repo (download them from the CAAI drone map page: weekday and weekend editions).
