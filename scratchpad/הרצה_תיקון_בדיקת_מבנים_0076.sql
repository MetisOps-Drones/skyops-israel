-- Fixes a real bug in buildings_near_point (0075): the bbox pre-filter
-- converted distance_m to degrees using meters-per-degree-latitude
-- (111,320) for BOTH axes. At Israel's latitude (~29-33°N), a degree of
-- longitude covers noticeably fewer meters (~94,000-96,000) than a degree
-- of latitude, so the east-west half of that bbox was ~15% narrower than
-- the actual required distance — a building sitting just east or west of
-- the point (rather than north/south) could fall outside the bbox and
-- never reach the exact st_dwithin check at all. Use the smaller
-- meters-per-degree constant for the bbox buffer instead, so it's always
-- at least as large as needed in every direction (over-inclusive, not
-- under) — the exact st_dwithin check below the bbox is what determines
-- the real answer either way, so an oversized bbox costs a few extra rows
-- scanned, never a wrong result.
create or replace function buildings_near_point(lng double precision, lat double precision, distance_m double precision)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from buildings b
    where b.geom && st_expand(
      st_setsrid(st_makepoint(lng, lat), 4326),
      distance_m / 94000.0
    )
    and st_dwithin(
      geography(b.geom),
      geography(st_setsrid(st_makepoint(lng, lat), 4326)),
      distance_m
    )
    limit 1
  );
$$;
