-- Safe to run any number of times. Fixes the "budget_ils column not
-- found" error by making sure the 5 new columns genuinely exist, and
-- drops+recreates the two RPC functions (needed because Postgres refuses
-- to CREATE OR REPLACE a function whose return columns changed — this
-- just redefines them, no data is touched).

alter table marketplace_bookings
  add column if not exists location text,
  add column if not exists budget_ils numeric(10, 2),
  add column if not exists operation_type text,
  add column if not exists drone_type text,
  add column if not exists purpose text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'marketplace_bookings_budget_non_negative'
  ) then
    alter table marketplace_bookings
      add constraint marketplace_bookings_budget_non_negative check (budget_ils is null or budget_ils >= 0);
  end if;
end $$;

drop function if exists my_marketplace_bookings();
drop function if exists get_marketplace_booking(uuid);

create function my_marketplace_bookings()
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  pilot_id uuid,
  pilot_full_name text,
  pilot_avatar_url text,
  created_by uuid,
  title text,
  description text,
  location text,
  budget_ils numeric,
  operation_type text,
  drone_type text,
  purpose text,
  start_time timestamptz,
  end_time timestamptz,
  status booking_status,
  association_code text,
  association_expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  return query
    select
      b.id, b.org_id, o.name, b.pilot_id, p.full_name, p.avatar_url, b.created_by,
      b.title, b.description, b.location, b.budget_ils, b.operation_type, b.drone_type, b.purpose,
      b.start_time, b.end_time, b.status,
      case when b.pilot_id = auth.uid() or is_same_org(b.org_id) then b.association_code else null end,
      b.association_expires_at, b.created_at
    from marketplace_bookings b
    join organizations o on o.id = b.org_id
    join profiles p on p.id = b.pilot_id
    where b.pilot_id = auth.uid() or b.org_id = current_org_id()
    order by b.created_at desc;
end;
$$;

create function get_marketplace_booking(target_booking_id uuid)
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  pilot_id uuid,
  pilot_full_name text,
  pilot_avatar_url text,
  created_by uuid,
  title text,
  description text,
  location text,
  budget_ils numeric,
  operation_type text,
  drone_type text,
  purpose text,
  start_time timestamptz,
  end_time timestamptz,
  status booking_status,
  association_code text,
  association_expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  return query
    select
      b.id, b.org_id, o.name, b.pilot_id, p.full_name, p.avatar_url, b.created_by,
      b.title, b.description, b.location, b.budget_ils, b.operation_type, b.drone_type, b.purpose,
      b.start_time, b.end_time, b.status,
      case when b.pilot_id = auth.uid() or is_same_org(b.org_id) then b.association_code else null end,
      b.association_expires_at, b.created_at
    from marketplace_bookings b
    join organizations o on o.id = b.org_id
    join profiles p on p.id = b.pilot_id
    where b.id = target_booking_id
      and (b.pilot_id = auth.uid() or b.org_id = current_org_id() or is_dispatcher_admin());
end;
$$;

notify pgrst, 'reload schema';
