-- Mock Israeli airspace boundaries so Module A's spatial validation is
-- testable immediately, without a real CAAI/IAF data feed. Coordinates are
-- approximate and for development use only — do not fly on these.

insert into airspace_zones (name, type, min_altitude_m, max_altitude_m, geom, active_schedule, source_notes)
values
  (
    'Ben Gurion CTR',
    'CTR',
    0,
    3000,
    ST_Multi(
      ST_Buffer(
        ST_SetSRID(ST_MakePoint(34.8867, 32.0114), 4326)::geography,
        9000
      )::geometry
    ),
    '{"always_active": true}'::jsonb,
    'Approximate 9km control-zone radius around LLBG. Mock data for development.'
  ),
  (
    'Palmachim Airbase Restricted Area',
    'RESTRICTED_AREA',
    0,
    3000,
    ST_Multi(
      ST_Buffer(
        ST_SetSRID(ST_MakePoint(34.6893, 31.8968), 4326)::geography,
        12000
      )::geometry
    ),
    '{"always_active": true}'::jsonb,
    'Approximate 12km restricted radius around Palmachim airbase. Mock data for development.'
  ),
  (
    'Tel Aviv Urban Zone',
    'RESTRICTED_AREA',
    0,
    1000,
    ST_Multi(
      ST_MakeEnvelope(34.74, 32.03, 34.82, 32.13, 4326)
    ),
    '{"always_active": true}'::jsonb,
    'Bounding box over central Tel Aviv. Dense urban area — no unpermitted flight. Mock data.'
  ),
  (
    'North Firing Zone',
    'FIRING_ZONE',
    0,
    5000,
    ST_Multi(
      ST_MakeEnvelope(35.55, 33.05, 35.75, 33.25, 4326)
    ),
    '{"always_active": false, "schedule_note": "Active during scheduled IDF live-fire exercises only"}'::jsonb,
    'Approximate Golan/Upper Galilee live-fire training area bounding box. Mock data for development.'
  );
