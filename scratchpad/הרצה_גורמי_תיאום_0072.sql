-- Admin-only directory of who to call for airspace coordination in a given
-- area (יבא/מבא/אוגדה/פיקוח/אחר), plus a per-flight-request tracking log
-- for that *external* coordination — deliberately separate from
-- flight_requests.dispatcher_notes, which is the pilot-facing
-- rejection-reason text. Phone numbers and unit names here must never
-- reach the org/pilot side; both tables are gated to is_dispatcher_admin()
-- only, with no participant-style exception (unlike marketplace_bookings
-- etc., there is no "other side" that should ever see this).
--
-- Coverage area uses the same coarse circle convention as
-- aip_reference_zones (0023) rather than requiring precise polygons up
-- front — real boundaries can be refined later without a schema change.

create table coordination_authorities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit_type text not null,
  phone text not null,
  backup_phone text,
  notes text,
  center_lng double precision not null,
  center_lat double precision not null,
  radius_m integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger coordination_authorities_set_updated_at
  before update on coordination_authorities
  for each row execute function set_updated_at();

alter table coordination_authorities enable row level security;

create policy "Dispatcher admins manage coordination authorities"
  on coordination_authorities for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

-- Point lookup — a plain (non security-definer) stable function so RLS on
-- the underlying table applies as-is: a non-admin caller simply gets zero
-- rows back, same as querying the table directly.
create or replace function find_coordination_authority(lng double precision, lat double precision)
returns setof coordination_authorities
language sql
stable
as $$
  select *
  from coordination_authorities
  where st_dwithin(
    geography(st_setsrid(st_makepoint(center_lng, center_lat), 4326)),
    geography(st_setsrid(st_makepoint(lng, lat), 4326)),
    radius_m
  );
$$;

create type coordination_contact_status as enum (
  'not_started',
  'awaiting_contact',
  'awaiting_response',
  'approved',
  'denied'
);

create table flight_request_coordination (
  id uuid primary key default uuid_generate_v4(),
  flight_request_id uuid not null unique references flight_requests (id) on delete cascade,
  authority_id uuid references coordination_authorities (id) on delete set null,
  status coordination_contact_status not null default 'not_started',
  notes text,
  updated_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger flight_request_coordination_set_updated_at
  before update on flight_request_coordination
  for each row execute function set_updated_at();

alter table flight_request_coordination enable row level security;

create policy "Dispatcher admins manage flight request coordination"
  on flight_request_coordination for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());
