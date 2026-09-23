-- Fills the LLBG (Ben Gurion) CTR gap confirmed during this session: the
-- official-AIP digitization in 0024_aip_zones_real_polygons.sql only ever
-- carried a TMA row for LLBG (3000-9000ft, code LLBG) — every other major
-- airport in that rebuild got its CTR too, LLBG didn't. The 4 rows removed
-- in 0082_remove_mock_airspace_zones.sql were a different, unrelated table
-- (legacy `airspace_zones`) and did not cover this gap either.
--
-- IMPORTANT — provenance: unlike the 179 `geometry_precise = true` rows,
-- this polygon was NOT digitized from the official CAAI/AIP source that
-- 0024/0037 used (icd_kml). It was supplied by the user as 5 DMS
-- coordinates during this session, without a citable AIP chart reference.
-- It is geometrically plausible (a ~6-9km irregular boundary around LLBG's
-- real position, matching the compass-direction landmarks given — Or
-- Yehuda/Ganei Tikva, Elad/Nachshonim, Latrun, Ramla, Rishon/Beit Dagan)
-- and roughly matches the old mock circle's 9km radius, but it has not been
-- checked against an actual AIP chart page the way the other CTRs were.
-- Flagged geometry_precise = false so the UI shows its existing "boundary
-- is estimated" footnote (LocationInfoCard/FlightParamsDrawer) — replace
-- with a real digitization the same way 0037/0068 did for the other
-- approximate rows once an authoritative source is available.
--
-- Altitude (GND-2000ft QNH) matches the old mock 'CTR Ben Gurion' row from
-- 0023, which was itself plausible enough that nothing in 0082's removal
-- reasoning ever disputed the altitude figure — only the geometry/duplication.
insert into aip_reference_zones
  (name, code, kind, altitude_text, min_altitude_ft, max_altitude_ft, geom_geojson, source_sheet, source_edition, geometry_precise)
values (
  'בן גוריון',
  'LLBG',
  'CTR',
  'GND-2 000 QNH',
  0,
  2000,
  '{"type":"Polygon","coordinates":[[
    [34.838333, 32.056667],
    [34.933333, 32.05],
    [34.975, 31.975],
    [34.883333, 31.933333],
    [34.808333, 31.966667],
    [34.838333, 32.056667]
  ]]}'::jsonb,
  'user_supplied_unverified',
  '2026-09-23',
  false
);
