create table flight_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  drone_id uuid references drones (id) on delete set null,
  request_type flight_request_type not null,
  -- Written by the client as WKT text (PostGIS has an implicit text->geometry
  -- cast for WKT, but no cast from the JSON body PostgREST receives). Read
  -- back through the *_geojson mirror columns below, which a trigger keeps
  -- in sync — see the identical pattern on airspace_zones (0005).
  center_point geometry(Point, 4326) not null,
  center_point_geojson jsonb not null default '{}'::jsonb,
  radius_meters numeric(9, 2),
  polygon geometry(MultiPolygon, 4326),
  polygon_geojson jsonb,
  max_altitude_meters numeric(7, 2) not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status flight_request_status not null default 'draft',
  notam_code text,
  dispatcher_notes text,
  emergency_contact_phone text,
  intersecting_zone_ids uuid[] not null default '{}',
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint flight_request_time_range check (end_time > start_time),
  constraint flight_request_geom_present check (
    (request_type = 'basic_auto_100m' and radius_meters is not null)
    or (request_type = 'manual_notam_bubble')
  )
);

create index flight_requests_user_id_idx on flight_requests (user_id);
create index flight_requests_status_idx on flight_requests (status);
create index flight_requests_start_time_idx on flight_requests (start_time);
create index flight_requests_center_point_gix on flight_requests using gist (center_point);
create index flight_requests_polygon_gix on flight_requests using gist (polygon);

create trigger flight_requests_set_updated_at
  before update on flight_requests
  for each row execute function set_updated_at();

create or replace function sync_flight_request_geojson()
returns trigger
language plpgsql
as $$
begin
  new.center_point_geojson := st_asgeojson(new.center_point)::jsonb;
  new.polygon_geojson := case when new.polygon is null then null else st_asgeojson(new.polygon)::jsonb end;
  return new;
end;
$$;

create trigger flight_requests_sync_geojson
  before insert or update of center_point, polygon on flight_requests
  for each row execute function sync_flight_request_geojson();

-- Publishing a NOTAM requires the fields the dispatcher enters in Module B's
-- "Publish NOTAM" modal to actually be present.
create or replace function flight_requests_require_notam_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'notam_published' and (new.notam_code is null or new.notam_code = '') then
    raise exception 'notam_code is required before a flight_request can be marked notam_published';
  end if;
  if new.status = 'notam_published' and new.reviewed_at is null then
    new.reviewed_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

create trigger flight_requests_check_notam_fields
  before insert or update of status on flight_requests
  for each row execute function flight_requests_require_notam_fields();
