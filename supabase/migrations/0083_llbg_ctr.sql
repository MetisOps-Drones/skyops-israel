-- Fills the LLBG (Ben Gurion) CTR gap confirmed during this session: the
-- official-AIP digitization in 0024_aip_zones_real_polygons.sql only ever
-- carried a TMA row for LLBG (3000-9000ft, code LLBG) — every other major
-- airport in that rebuild got its CTR too, LLBG didn't. The 4 rows removed
-- in 0082_remove_mock_airspace_zones.sql were a different, unrelated table
-- (legacy `airspace_zones`) and did not cover this gap either.
--
-- Boundary supplied by the user directly from the published AIP CTR
-- definition (GND-2000ft QNH, Class C) as 5 DMS coordinates.
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
  'aip_israel',
  '2026-09-23',
  true
);
