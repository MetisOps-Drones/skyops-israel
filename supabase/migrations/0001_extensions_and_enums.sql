-- SkyOps Israel — core extensions and enum types
-- Requires a Supabase project (Postgres 15+). PostGIS ships in the Supabase image.

create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_cron"; -- used by 0011_functions_triggers.sql for the daily expiry sweep

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

create type user_role as enum (
  'pilot_hobby',
  'pilot_pro',
  'fleet_manager',
  'dispatcher_admin'
);

create type license_type as enum (
  'hobby',
  'commercial_25kg',
  'heavy_2000kg'
);

create type license_status as enum (
  'active',
  'expiring_soon',
  'expired'
);

create type drone_status as enum (
  'operational',
  'maintenance_required',
  'grounded',
  'retired'
);

create type battery_health_status as enum (
  'healthy',
  'degraded',
  'replace_soon',
  'condemned'
);

create type airspace_zone_type as enum (
  'CTR',
  'FIRING_ZONE',
  'RESTRICTED_AREA',
  'NATURE_RESERVE'
);

create type flight_request_type as enum (
  'basic_auto_100m',
  'manual_notam_bubble'
);

create type flight_request_status as enum (
  'draft',
  'auto_cleared',
  'pending_dispatcher',
  'submitted_to_iaf',
  'notam_published',
  'rejected',
  'completed',
  'cancelled'
);

create type lms_course_id as enum (
  'hobby_exam',
  'commercial_25kg'
);

-- Generic updated_at trigger reused by every table below.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
