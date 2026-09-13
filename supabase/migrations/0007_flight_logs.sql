create table flight_logs (
  id uuid primary key default uuid_generate_v4(),
  flight_request_id uuid references flight_requests (id) on delete set null,
  user_id uuid not null references profiles (id) on delete cascade,
  drone_id uuid not null references drones (id) on delete cascade,
  battery_id uuid references batteries (id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_minutes integer generated always as (
    greatest(0, round(extract(epoch from (end_time - start_time)) / 60))
  ) stored,
  max_altitude_m numeric(7, 2),
  max_distance_m numeric(9, 2),
  telemetry_data jsonb not null default '{}'::jsonb,
  telemetry_source text not null default 'manual' check (telemetry_source in ('manual', 'dji_csv', 'dji_txt')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint flight_log_time_range check (end_time > start_time)
);

create index flight_logs_user_id_idx on flight_logs (user_id);
create index flight_logs_drone_id_idx on flight_logs (drone_id);
create index flight_logs_start_time_idx on flight_logs (start_time desc);

create trigger flight_logs_set_updated_at
  before update on flight_logs
  for each row execute function set_updated_at();

-- Preventive-maintenance engine (Module C): every logged flight rolls its
-- duration into the airframe's lifetime minutes and, if a battery was
-- attached, bumps that battery's cycle count by one.
create or replace function apply_flight_log_wear()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update drones
  set total_flight_minutes = total_flight_minutes + new.duration_minutes
  where id = new.drone_id;

  if new.battery_id is not null then
    update batteries
    set cycle_count = cycle_count + 1
    where id = new.battery_id;
  end if;

  return new;
end;
$$;

create trigger flight_logs_apply_wear
  after insert on flight_logs
  for each row execute function apply_flight_log_wear();

-- Reverses the wear applied above if a log entry is deleted (e.g. duplicate
-- telemetry import), so hour/cycle counters never drift.
create or replace function revert_flight_log_wear()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update drones
  set total_flight_minutes = greatest(0, total_flight_minutes - old.duration_minutes)
  where id = old.drone_id;

  if old.battery_id is not null then
    update batteries
    set cycle_count = greatest(0, cycle_count - 1)
    where id = old.battery_id;
  end if;

  return old;
end;
$$;

create trigger flight_logs_revert_wear
  after delete on flight_logs
  for each row execute function revert_flight_log_wear();
