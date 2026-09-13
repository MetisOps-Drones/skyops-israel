-- Phase 1 equipment tracking (B-01..B-04 from the MetisOps feature review):
--   B-01 maintenance triggered by hours/cycles *since last service*, not a
--        one-way ratchet on lifetime totals (see the bug note below)
--   B-02 a technical log per airframe (repairs, part swaps, inspections)
--   B-03 spares/accessories inventory with low-stock alerts
--   B-04 battery health based on the *trend* in capacity readings, not just
--        a raw cycle-count threshold

-- ---------------------------------------------------------------------------
-- B-01. The existing periodic-inspection trigger (0004) compares lifetime
-- total_flight_minutes to a fixed 3000, which means once a drone crosses 50
-- lifetime hours it is reflagged maintenance_required on *every* subsequent
-- flight forever, even the day after real maintenance was done. Fix: measure
-- minutes *since the last maintenance event*, and make the interval
-- per-drone configurable.
-- ---------------------------------------------------------------------------

alter table drones
  add column maintenance_interval_minutes integer not null default 3000 check (maintenance_interval_minutes > 0),
  add column last_maintenance_at timestamptz,
  add column last_maintenance_flight_minutes integer not null default 0;

create or replace function drones_flag_periodic_inspection()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'operational'
     and (new.total_flight_minutes - new.last_maintenance_flight_minutes) >= new.maintenance_interval_minutes
  then
    new.status := 'maintenance_required';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- B-02. Technical log: repairs, part swaps, inspections — independent of
-- flight_logs, which only records flights.
-- ---------------------------------------------------------------------------

create type maintenance_entry_kind as enum ('inspection', 'repair', 'part_replacement', 'other');

create table drone_maintenance_log (
  id uuid primary key default uuid_generate_v4(),
  drone_id uuid not null references drones (id) on delete cascade,
  logged_by uuid references profiles (id) on delete set null,
  kind maintenance_entry_kind not null,
  description text not null,
  cost numeric(10, 2),
  performed_at date not null default current_date,
  created_at timestamptz not null default timezone('utc', now())
);

create index drone_maintenance_log_drone_id_idx on drone_maintenance_log (drone_id, performed_at desc);

-- Logging a completed inspection/repair resets the B-01 maintenance clock so
-- the drone doesn't stay stuck in maintenance_required after being serviced.
create or replace function apply_maintenance_log_reset()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.kind in ('inspection', 'repair') then
    update drones
    set last_maintenance_at = timezone('utc', now()),
        last_maintenance_flight_minutes = total_flight_minutes,
        status = 'operational'
    where id = new.drone_id and status = 'maintenance_required';
  end if;
  return new;
end;
$$;

create trigger drone_maintenance_log_apply_reset
  after insert on drone_maintenance_log
  for each row execute function apply_maintenance_log_reset();

-- ---------------------------------------------------------------------------
-- B-03. Spares/accessories inventory. Same exclusive ownership shape as
-- drones: belongs to a solo pilot OR an org, never both.
-- ---------------------------------------------------------------------------

create type inventory_item_category as enum ('propeller', 'battery', 'charger', 'gimbal', 'other');

create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles (id) on delete cascade,
  org_id uuid references organizations (id) on delete cascade,
  name text not null,
  category inventory_item_category not null default 'other',
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  low_stock_threshold integer not null default 1 check (low_stock_threshold >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inventory_owner_exclusive check (
    (user_id is not null and org_id is null) or (user_id is null and org_id is not null)
  )
);

create index inventory_items_user_id_idx on inventory_items (user_id);
create index inventory_items_org_id_idx on inventory_items (org_id);

create trigger inventory_items_set_updated_at
  before update on inventory_items
  for each row execute function set_updated_at();

alter type notification_kind add value 'low_inventory';

create or replace function notify_low_inventory()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.quantity_on_hand > new.low_stock_threshold then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.quantity_on_hand <= old.low_stock_threshold then
    return new; -- already notified, don't spam on every further decrement
  end if;

  insert into notifications (user_id, kind, title, body, metadata)
  select
    coalesce(new.user_id, om.user_id),
    'low_inventory',
    'מלאי נמוך: ' || new.name,
    'נותרו ' || new.quantity_on_hand || ' יחידות מתוך סף של ' || new.low_stock_threshold || '.',
    jsonb_build_object('inventory_item_id', new.id)
  from (select 1) as _
  left join organization_members om
    on new.org_id is not null and om.org_id = new.org_id and om.status = 'active' and om.role = 'fleet_manager'
  where new.user_id is not null or om.user_id is not null;

  return new;
end;
$$;

create trigger inventory_items_notify_low_stock
  after insert or update of quantity_on_hand on inventory_items
  for each row execute function notify_low_inventory();

-- ---------------------------------------------------------------------------
-- B-04. Battery health from a *trend* in capacity readings rather than raw
-- cycle count alone: a battery that's losing capacity fast gets flagged
-- before it hits the cycle-count thresholds from 0004.
-- ---------------------------------------------------------------------------

create table battery_readings (
  id uuid primary key default uuid_generate_v4(),
  battery_id uuid not null references batteries (id) on delete cascade,
  recorded_at timestamptz not null default timezone('utc', now()),
  voltage numeric(5, 2),
  capacity_percent numeric(5, 2) check (capacity_percent between 0 and 100),
  source text not null default 'manual' check (source in ('manual', 'telemetry')),
  created_at timestamptz not null default timezone('utc', now())
);

create index battery_readings_battery_id_idx on battery_readings (battery_id, recorded_at desc);

create or replace function apply_battery_reading()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  baseline_capacity numeric(5, 2);
begin
  if new.voltage is not null then
    update batteries set last_voltage_reading = new.voltage where id = new.battery_id;
  end if;

  if new.capacity_percent is null then
    return new;
  end if;

  -- Compare against the oldest reading in the last 30 days: a steep drop
  -- means real degradation, not sensor noise from one bad reading.
  select capacity_percent into baseline_capacity
  from battery_readings
  where battery_id = new.battery_id
    and recorded_at <= new.recorded_at - interval '30 days'
  order by recorded_at desc
  limit 1;

  if baseline_capacity is not null and (baseline_capacity - new.capacity_percent) >= 15 then
    update batteries
    set health_status = 'replace_soon'
    where id = new.battery_id and health_status = 'healthy';
  end if;

  return new;
end;
$$;

create trigger battery_readings_apply
  after insert on battery_readings
  for each row execute function apply_battery_reading();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table drone_maintenance_log enable row level security;
alter table inventory_items enable row level security;
alter table battery_readings enable row level security;

create policy "Users manage maintenance logs on drones they can manage"
  on drone_maintenance_log for all
  using (
    exists (
      select 1 from drones d
      where d.id = drone_maintenance_log.drone_id
        and (d.user_id = auth.uid() or (d.org_id is not null and is_same_org(d.org_id)))
    )
  )
  with check (
    exists (
      select 1 from drones d
      where d.id = drone_maintenance_log.drone_id
        and (d.user_id = auth.uid() or (d.org_id is not null and is_same_org(d.org_id)))
    )
  );

create policy "Dispatcher admins read all maintenance logs"
  on drone_maintenance_log for select
  using (is_dispatcher_admin());

create policy "Owners manage their own inventory"
  on inventory_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Org members read their inventory"
  on inventory_items for select
  using (org_id is not null and is_same_org(org_id));

create policy "Fleet managers manage their inventory"
  on inventory_items for all
  using (org_id is not null and is_org_fleet_manager(org_id))
  with check (org_id is not null and is_org_fleet_manager(org_id));

create policy "Dispatcher admins read all inventory"
  on inventory_items for select
  using (is_dispatcher_admin());

create policy "Users manage readings on batteries they can manage"
  on battery_readings for all
  using (
    exists (
      select 1 from batteries b
      join drones d on d.id = b.drone_id
      where b.id = battery_readings.battery_id
        and (d.user_id = auth.uid() or (d.org_id is not null and is_same_org(d.org_id)))
    )
  )
  with check (
    exists (
      select 1 from batteries b
      join drones d on d.id = b.drone_id
      where b.id = battery_readings.battery_id
        and (d.user_id = auth.uid() or (d.org_id is not null and is_same_org(d.org_id)))
    )
  );

create policy "Dispatcher admins read all battery readings"
  on battery_readings for select
  using (is_dispatcher_admin());
