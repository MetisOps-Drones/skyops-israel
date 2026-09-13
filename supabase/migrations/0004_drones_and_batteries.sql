create table drones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles (id) on delete cascade,
  org_id uuid references organizations (id) on delete cascade,
  nickname text not null,
  manufacturer text not null,
  model text not null,
  serial_number text not null,
  registration_number text,
  mtow_grams integer not null check (mtow_grams > 0),
  total_flight_minutes integer not null default 0 check (total_flight_minutes >= 0),
  status drone_status not null default 'operational',
  last_inspection_at date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (serial_number),
  constraint drone_owner_present check (user_id is not null or org_id is not null)
);

create index drones_user_id_idx on drones (user_id);
create index drones_org_id_idx on drones (org_id);

create trigger drones_set_updated_at
  before update on drones
  for each row execute function set_updated_at();

-- 50 flight-hour periodic inspection gate (Module C requirement).
create or replace function drones_flag_periodic_inspection()
returns trigger
language plpgsql
as $$
begin
  if new.total_flight_minutes >= 3000 and new.status = 'operational' then
    new.status := 'maintenance_required';
  end if;
  return new;
end;
$$;

create trigger drones_check_periodic_inspection
  before update of total_flight_minutes on drones
  for each row execute function drones_flag_periodic_inspection();

create table batteries (
  id uuid primary key default uuid_generate_v4(),
  drone_id uuid not null references drones (id) on delete cascade,
  serial_number text not null,
  cycle_count integer not null default 0 check (cycle_count >= 0),
  health_status battery_health_status not null default 'healthy',
  last_voltage_reading numeric(5, 2),
  purchased_at date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (serial_number)
);

create index batteries_drone_id_idx on batteries (drone_id);

create trigger batteries_set_updated_at
  before update on batteries
  for each row execute function set_updated_at();

-- 200-cycle wear warning (Module C requirement).
create or replace function batteries_flag_wear()
returns trigger
language plpgsql
as $$
begin
  if new.cycle_count > 200 and new.health_status = 'healthy' then
    new.health_status := 'replace_soon';
  end if;
  if new.cycle_count > 300 then
    new.health_status := 'condemned';
  end if;
  return new;
end;
$$;

create trigger batteries_check_wear
  before insert or update of cycle_count on batteries
  for each row execute function batteries_flag_wear();
