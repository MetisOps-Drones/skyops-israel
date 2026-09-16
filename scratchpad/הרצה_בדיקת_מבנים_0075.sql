-- Authoritative building-proximity check, querying the same `buildings`
-- table (0067_buildings_layer.sql, ~3.5M real footprints) that already
-- backs the map's vector-tile layer via buildings_mvt() — not a separate
-- static bitmap grid exported to R2. That export step (a fixed-resolution
-- bitmap, manually regenerated and uploaded out of band) was a second,
-- unsynchronized copy of the same data: if it went stale, was never
-- regenerated after 0067 landed, or the R2 file/URL was simply never
-- configured, the proximity check silently had nothing to check against.
-- Querying `buildings` directly means there is exactly one buildings
-- dataset in this app, and anything that reads it — the map tiles, this
-- check — reads the same rows.
--
-- Takes the exact required distance in meters (no more snapping to a
-- handful of precomputed altitude bands) since this is a live query, not a
-- lookup into a precomputed grid.
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
      distance_m / 111320.0
    )
    and st_dwithin(
      geography(b.geom),
      geography(st_setsrid(st_makepoint(lng, lat), 4326)),
      distance_m
    )
    limit 1
  );
$$;
