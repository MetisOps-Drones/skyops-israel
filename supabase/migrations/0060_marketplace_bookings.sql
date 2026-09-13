-- Freelancer booking flow, agreed shape:
--   org sends a job invitation with a proposed time range -> pilot approves
--   (chat opens, slot goes on hold) -> deal gets confirmed in-chat (slot is
--   now locked for real) -> pilot can decline/cancel at any point before
--   confirmation, either side can cancel after.
--
-- The double-booking guard is a single Postgres exclusion constraint on
-- (pilot_id, time range) restricted to the two statuses that actually hold
-- the slot ('pending' = mid-negotiation hold, 'confirmed' = locked) — an
-- 'invited' offer that nobody has responded to yet does NOT block the slot,
-- so multiple orgs can propose the same window and whichever the pilot
-- approves first wins it; approving a second, overlapping one is rejected
-- by the constraint itself (race-safe, unlike an app-level check).

create extension if not exists "btree_gist";

create type booking_status as enum ('invited', 'pending', 'confirmed', 'declined', 'cancelled', 'completed');

create table marketplace_bookings (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations (id) on delete cascade,
  pilot_id uuid not null references profiles (id) on delete cascade,
  created_by uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status booking_status not null default 'invited',
  responded_at timestamptz,
  confirmed_at timestamptz,
  -- Only the pilot ever confirms (see enforce_booking_status_transition) —
  -- their own slot is what's being locked, so they hold final say.
  confirmed_by uuid references profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles (id) on delete set null,
  -- Set on confirm; lets either side tie a flight_request to this engagement
  -- afterwards (see 0062) without reworking flight_requests' single-owner
  -- shape. Short-lived on purpose — a real calendar integration is future
  -- work, this is the v1 bridge.
  association_code text unique,
  association_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint marketplace_bookings_time_range check (end_time > start_time),
  constraint marketplace_bookings_confirmed_by_is_pilot check (confirmed_by is null or confirmed_by = pilot_id),
  exclude using gist (
    pilot_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status in ('pending', 'confirmed'))
);

create index marketplace_bookings_org_id_idx on marketplace_bookings (org_id);
create index marketplace_bookings_pilot_id_idx on marketplace_bookings (pilot_id);
create index marketplace_bookings_status_idx on marketplace_bookings (status);

create trigger marketplace_bookings_set_updated_at
  before update on marketplace_bookings
  for each row execute function set_updated_at();

alter table marketplace_bookings enable row level security;

create policy "Org members send booking invitations"
  on marketplace_bookings for insert
  with check (org_id = current_org_id() and created_by = auth.uid() and status = 'invited');

create policy "Participants read their bookings"
  on marketplace_bookings for select
  using (pilot_id = auth.uid() or org_id = current_org_id() or is_dispatcher_admin());

-- Permissive on purpose — enforce_booking_status_transition() below is the
-- actual state-machine guard (who may move which status to which), so this
-- just lets a participant's update reach that trigger at all.
create policy "Participants update their bookings"
  on marketplace_bookings for update
  using (pilot_id = auth.uid() or org_id = current_org_id())
  with check (pilot_id = auth.uid() or org_id = current_org_id());

create policy "Dispatcher admins manage all bookings"
  on marketplace_bookings for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- Status state machine
-- ---------------------------------------------------------------------------

create or replace function enforce_booking_status_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'invited' and new.status = 'pending' then
    if auth.uid() <> old.pilot_id and not is_dispatcher_admin() then
      raise exception 'Only the pilot can accept a booking invitation';
    end if;
    new.responded_at := timezone('utc', now());
  elsif old.status = 'invited' and new.status = 'declined' then
    if auth.uid() <> old.pilot_id and not is_dispatcher_admin() then
      raise exception 'Only the pilot can decline a booking invitation';
    end if;
    new.responded_at := timezone('utc', now());
  elsif old.status = 'pending' and new.status = 'confirmed' then
    if auth.uid() <> old.pilot_id and not is_dispatcher_admin() then
      raise exception 'Only the pilot can confirm the deal';
    end if;
    new.confirmed_at := timezone('utc', now());
    new.confirmed_by := old.pilot_id;
    new.association_code := upper(substr(md5(random()::text || old.id::text || clock_timestamp()::text), 1, 8));
    new.association_expires_at := old.end_time + interval '48 hours';
  elsif old.status in ('pending', 'confirmed') and new.status = 'cancelled' then
    if auth.uid() <> old.pilot_id and not is_same_org(old.org_id) and not is_dispatcher_admin() then
      raise exception 'Not authorized to cancel this booking';
    end if;
    new.cancelled_at := timezone('utc', now());
    new.cancelled_by := auth.uid();
  else
    raise exception 'Invalid booking status transition from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger marketplace_bookings_enforce_transition
  before update of status on marketplace_bookings
  for each row execute function enforce_booking_status_transition();

-- ---------------------------------------------------------------------------
-- app_events (monitoring "כל תנועה" around a booking, matching 0020's convention)
-- ---------------------------------------------------------------------------

create or replace function log_booking_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into app_events (actor_id, org_id, event_name, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    new.org_id,
    'booking.' || new.status,
    'marketplace_booking',
    new.id,
    jsonb_build_object('pilot_id', new.pilot_id, 'previous_status', case when tg_op = 'UPDATE' then old.status else null end)
  );
  return new;
end;
$$;

create trigger marketplace_bookings_log_event
  after insert or update of status on marketplace_bookings
  for each row execute function log_booking_event();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

alter type notification_kind add value 'booking_invited';
alter type notification_kind add value 'booking_accepted';
alter type notification_kind add value 'booking_declined';
alter type notification_kind add value 'booking_confirmed';
alter type notification_kind add value 'booking_cancelled';
alter type notification_kind add value 'booking_message_received';

create or replace function notify_booking_invited()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  org_name text;
begin
  select name into org_name from organizations where id = new.org_id;
  insert into notifications (user_id, kind, title, body, metadata)
  values (
    new.pilot_id,
    'booking_invited',
    'הזמנת עבודה חדשה',
    coalesce(org_name, 'ארגון') || ' שלח/ה לך הזמנת עבודה: ' || new.title,
    jsonb_build_object('booking_id', new.id, 'org_id', new.org_id)
  );
  return new;
end;
$$;

create trigger marketplace_bookings_notify_invited
  after insert on marketplace_bookings
  for each row execute function notify_booking_invited();

create or replace function notify_booking_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pilot_name text;
  target_user uuid;
  the_kind notification_kind;
  the_title text;
  the_body text;
begin
  if new.status = old.status then
    return new;
  end if;

  select full_name into pilot_name from profiles where id = new.pilot_id;

  if new.status = 'pending' then
    target_user := new.created_by;
    the_kind := 'booking_accepted';
    the_title := 'ההזמנה אושרה — נפתח צ׳אט';
    the_body := coalesce(pilot_name, 'המטיס/ה') || ' אישר/ה את הצעת העבודה. אפשר לתאם פרטים בצ׳אט.';
  elsif new.status = 'declined' then
    target_user := new.created_by;
    the_kind := 'booking_declined';
    the_title := 'ההזמנה נדחתה';
    the_body := coalesce(pilot_name, 'המטיס/ה') || ' דחה/תה את הצעת העבודה.';
  elsif new.status = 'confirmed' then
    target_user := new.created_by;
    the_kind := 'booking_confirmed';
    the_title := 'העסקה אושרה סופית';
    the_body := 'העסקה עם ' || coalesce(pilot_name, 'המטיס/ה') || ' אושרה. הסלוט ננעל בלוח הזמנים שלו/ה.';
  elsif new.status = 'cancelled' then
    target_user := case when auth.uid() = new.pilot_id then new.created_by else new.pilot_id end;
    the_kind := 'booking_cancelled';
    the_title := 'העסקה בוטלה';
    the_body := 'העסקה "' || new.title || '" בוטלה.';
  else
    return new;
  end if;

  insert into notifications (user_id, kind, title, body, metadata)
  values (target_user, the_kind, the_title, the_body, jsonb_build_object('booking_id', new.id));

  return new;
end;
$$;

create trigger marketplace_bookings_notify_status_change
  after update of status on marketplace_bookings
  for each row execute function notify_booking_status_change();

-- ---------------------------------------------------------------------------
-- Client reads: my sent invitations (org side) / my incoming invitations (pilot side)
-- ---------------------------------------------------------------------------

create or replace function my_marketplace_bookings()
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
      b.title, b.description, b.start_time, b.end_time, b.status,
      case when b.pilot_id = auth.uid() or is_same_org(b.org_id) then b.association_code else null end,
      b.association_expires_at, b.created_at
    from marketplace_bookings b
    join organizations o on o.id = b.org_id
    join profiles p on p.id = b.pilot_id
    where b.pilot_id = auth.uid() or b.org_id = current_org_id()
    order by b.created_at desc;
end;
$$;
