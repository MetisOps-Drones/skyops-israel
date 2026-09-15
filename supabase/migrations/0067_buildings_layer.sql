-- Building-footprint layer for the map (VIDA/Overture-style global buildings
-- dataset — combined Google Open Buildings + Microsoft Building Footprints +
-- OpenStreetMap, ODbL-licensed), clipped to Israel's operating envelope.
-- At ~3.5M rows this is far too large to ship as GeoJSON — it's served as
-- Mapbox Vector Tiles via buildings_mvt() below, not through PostgREST
-- row-selects like the small zone tables.

create table buildings (
  id bigserial primary key,
  source_id bigint,
  occupancy text,
  height text,
  geom geometry(Geometry, 4326) not null
);

create index buildings_geom_gix on buildings using gist (geom);

alter table buildings enable row level security;

create policy "Authenticated users read buildings"
  on buildings for select
  using (auth.role() = 'authenticated');

-- Standard XYZ/Slippy-map vector tile endpoint. Simplifies + clips geometry
-- to the tile automatically via ST_AsMVTGeom; the bounding-box index scan
-- (`geom &&`) keeps this fast even at 3.5M rows since a tile only ever
-- touches a tiny fraction of the table.
create or replace function buildings_mvt(z integer, x integer, y integer)
returns bytea
language sql
stable
as $$
  with bounds as (
    select st_tileenvelope(z, x, y) as tile
  ),
  mvtgeom as (
    select
      st_asmvtgeom(b.geom, bounds.tile) as geom,
      b.occupancy,
      b.height
    from buildings b, bounds
    where b.geom && bounds.tile
  )
  select st_asmvt(mvtgeom, 'buildings') from mvtgeom;
$$;
