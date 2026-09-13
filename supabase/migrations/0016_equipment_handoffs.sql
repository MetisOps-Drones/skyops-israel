-- A contractor pilot working for an org doesn't own the org's drones and
-- shouldn't get the fleet-manager "manage my fleet" screen. What they need
-- instead is a checkout/return record: confirm they took a specific drone in
-- good condition, and confirm what condition it came back in.

create type equipment_condition as enum ('good', 'minor_issue', 'damaged');
create type equipment_handoff_status as enum ('checked_out', 'returned');

create table equipment_handoffs (
  id uuid primary key default uuid_generate_v4(),
  drone_id uuid not null references drones (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status equipment_handoff_status not null default 'checked_out',
  checked_out_at timestamptz not null default timezone('utc', now()),
  checked_out_condition equipment_condition not null default 'good',
  checked_out_notes text,
  checked_in_at timestamptz,
  checked_in_condition equipment_condition,
  checked_in_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index equipment_handoffs_drone_id_idx on equipment_handoffs (drone_id);
create index equipment_handoffs_user_id_idx on equipment_handoffs (user_id, status);

create trigger equipment_handoffs_set_updated_at
  before update on equipment_handoffs
  for each row execute function set_updated_at();

-- A drone can only be checked out to one person at a time.
create unique index equipment_handoffs_one_active_per_drone
  on equipment_handoffs (drone_id)
  where status = 'checked_out';

create or replace function equipment_handoffs_require_checkin_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'returned' then
    if new.checked_in_condition is null then
      raise exception 'checked_in_condition is required when returning equipment';
    end if;
    if new.checked_in_at is null then
      new.checked_in_at := timezone('utc', now());
    end if;
    if new.checked_in_condition = 'damaged' and (new.checked_in_notes is null or new.checked_in_notes = '') then
      raise exception 'checked_in_notes is required when equipment comes back damaged';
    end if;
  end if;
  return new;
end;
$$;

create trigger equipment_handoffs_check_return_fields
  before insert or update of status on equipment_handoffs
  for each row execute function equipment_handoffs_require_checkin_fields();

-- Damage reported on return goes straight into the technical log (B-02) so
-- it shows up in the drone's maintenance history without a second manual step.
create or replace function equipment_handoffs_log_damage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'returned' and new.checked_in_condition <> 'good'
     and (old.status is distinct from 'returned')
  then
    insert into drone_maintenance_log (drone_id, logged_by, kind, description, performed_at)
    values (
      new.drone_id,
      new.user_id,
      'other',
      'דווח בהחזרת ציוד: ' || coalesce(new.checked_in_notes, new.checked_in_condition::text),
      current_date
    );
  end if;
  return new;
end;
$$;

create trigger equipment_handoffs_notify_damage
  after update of status on equipment_handoffs
  for each row execute function equipment_handoffs_log_damage();

alter table equipment_handoffs enable row level security;

create policy "Users manage their own handoffs"
  on equipment_handoffs for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from drones d
      where d.id = equipment_handoffs.drone_id
        and (d.user_id = auth.uid() or (d.org_id is not null and is_same_org(d.org_id)))
    )
  );

create policy "Fleet managers read handoffs on their fleet"
  on equipment_handoffs for select
  using (
    exists (
      select 1 from drones d
      where d.id = equipment_handoffs.drone_id
        and d.org_id is not null
        and is_org_fleet_manager(d.org_id)
    )
  );

create policy "Dispatcher admins read all handoffs"
  on equipment_handoffs for select
  using (is_dispatcher_admin());
