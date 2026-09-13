-- Spatial reference table. Geometry is stored as Polygon/MultiPolygon in
-- WGS84 (SRID 4326) to match GeoJSON coming straight out of Mapbox GL Draw.

create table airspace_zones (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type airspace_zone_type not null,
  min_altitude_m numeric(7, 2) not null default 0,
  max_altitude_m numeric(7, 2) not null,
  geom geometry(MultiPolygon, 4326) not null,
  -- PostgREST serializes a raw `geometry` column as EWKB hex, not GeoJSON —
  -- this mirror column is kept in sync by the trigger below so clients can
  -- select it directly instead of round-tripping through ST_AsGeoJSON.
  geom_geojson jsonb not null default '{}'::jsonb,
  active_schedule jsonb not null default '{"always_active": true}'::jsonb,
  source_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint airspace_altitude_range check (max_altitude_m >= min_altitude_m)
);

create index airspace_zones_geom_gix on airspace_zones using gist (geom);
create index airspace_zones_type_idx on airspace_zones (type);

create trigger airspace_zones_set_updated_at
  before update on airspace_zones
  for each row execute function set_updated_at();

create or replace function sync_airspace_zone_geojson()
returns trigger
language plpgsql
as $$
begin
  new.geom_geojson := st_asgeojson(new.geom)::jsonb;
  return new;
end;
$$;

create trigger airspace_zones_sync_geojson
  before insert or update of geom on airspace_zones
  for each row execute function sync_airspace_zone_geojson();

-- Core spatial query used by Module A's real-time bubble check. Given a
-- candidate flight geometry + altitude band, returns every airspace_zone it
-- intersects so the client can decide instant-clearance vs. dispatcher queue.
--
-- `candidate_geom_geojson` is accepted as jsonb (not `geometry`) because
-- PostgREST/PostGIS has no implicit cast from the JSON body a Supabase RPC
-- call sends into `geometry` — the client passes a plain GeoJSON object and
-- this function converts it explicitly with ST_GeomFromGeoJSON.
create or replace function find_intersecting_zones(
  candidate_geom_geojson jsonb,
  candidate_min_alt numeric,
  candidate_max_alt numeric
)
returns setof airspace_zones
language sql
stable
as $$
  select z.*
  from airspace_zones z
  where st_intersects(z.geom, st_setsrid(st_geomfromgeojson(candidate_geom_geojson::text), 4326))
    and z.min_altitude_m <= candidate_max_alt
    and z.max_altitude_m >= candidate_min_alt;
$$;
