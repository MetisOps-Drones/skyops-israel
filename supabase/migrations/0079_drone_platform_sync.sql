-- Auto-sync flight logbook from a DJI/Autel account instead of a manual CSV
-- upload (see TelemetryUploader.tsx for the existing manual path this sits
-- alongside, not replaces — CSV import stays available as a fallback).
--
-- Neither DJI nor Autel offers a self-service public API for an individual
-- pilot's flight-log data: DJI's real integration path (FlightHub 2 / Cloud
-- API) is an enterprise developer program requiring an approved business
-- application, and Autel has no comparable public consumer API at all. So
-- this table/action set is real infrastructure — the connect flow, the sync
-- state, the webhook receiver — but the sync itself runs in simulated mode
-- (clearly labeled to the pilot) until real platform credentials exist. See
-- src/actions/drone-platform-sync.ts.

create type drone_platform as enum ('dji', 'autel');
create type drone_platform_connection_status as enum ('connected', 'disconnected');

create table drone_platform_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  platform drone_platform not null,
  status drone_platform_connection_status not null default 'connected',
  account_label text,
  connected_at timestamptz not null default timezone('utc', now()),
  last_synced_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, platform)
);

create trigger drone_platform_connections_set_updated_at
  before update on drone_platform_connections
  for each row execute function set_updated_at();

alter table drone_platform_connections enable row level security;

create policy "Pilots manage their own platform connections"
  on drone_platform_connections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
