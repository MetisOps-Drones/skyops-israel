-- ============================================================
-- MIGRATIONS 0059-0067 — run this whole file once in Supabase SQL Editor
-- ============================================================

-- ---------- START 0059_backfill_drone_registration_expiry.sql ----------
-- 0057 only defaults registration_expires_at on INSERT, so every drone that
-- already existed before that migration ran was left with a null expiry —
-- DroneRegistrationBadge renders nothing for a null expiresAt, silently
-- hiding the whole feature for all pre-existing fleets. Backfill the same
-- 4-year-from-today default for rows that have a registration_number but no
-- expiry yet.
update drones
set registration_expires_at = (timezone('utc', now())::date) + interval '4 years'
where registration_number is not null
  and registration_expires_at is null;
-- ---------- END 0059_backfill_drone_registration_expiry.sql ----------

-- ---------- START 0060_fix_empty_string_registration_number.sql ----------
-- The drone-registration form submits "" (not null) for a blank
-- registration_number field, so both default_drone_registration_expiry()
-- (0057) and the 0059 backfill treated "no registration entered" as "has a
-- registration", handing out a fake 4-year validity badge. Redefine the
-- trigger to treat '' the same as null, and undo the wrong backfill for any
-- drone that has no real registration number.
create or replace function default_drone_registration_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.registration_number is not null and new.registration_number <> '' and new.registration_expires_at is null then
    new.registration_expires_at := (timezone('utc', now())::date) + interval '4 years';
  end if;
  return new;
end;
$$;

update drones
set registration_expires_at = null
where (registration_number is null or registration_number = '')
  and registration_expires_at is not null;
-- ---------- END 0060_fix_empty_string_registration_number.sql ----------

-- ---------- START 0061_pilot_pricing_and_portfolio.sql ----------
-- Two of the freelancer-booking-flow asks that don't touch scheduling:
--   1. A pilot's rate card (hourly/daily/equipment) — kept in its own table,
--      never joined into the marketplace-browse RPCs (marketplace_freelancers /
--      get_marketplace_pilot_profile), since prices are deliberately NOT
--      exposed on the public marketplace (agreed: negotiated in-chat instead,
--      see 0062+). Unlike `pilot_profiles` (0051), this table gets NO blanket
--      "org accounts read" policy — that's exactly the exposure this needs to
--      avoid, matching the phone-number lesson from 0049.
--   2. A portfolio gallery so a pilot can show past work to an org evaluating
--      them. Unlike pricing this *is* meant to be browsed pre-hire, so org
--      accounts get read access to the metadata rows; the backing files stay
--      in a private bucket (signed URLs generated on demand, same convention
--      `licenses` already uses in 0009/0013 and src/actions/documents.ts).

create table pilot_pricing (
  pilot_id uuid primary key references profiles (id) on delete cascade,
  hourly_rate_ils numeric(10, 2) check (hourly_rate_ils is null or hourly_rate_ils >= 0),
  daily_rate_ils numeric(10, 2) check (daily_rate_ils is null or daily_rate_ils >= 0),
  -- [{ "name": "מצלמה תרמית", "price_ils": 300 }, ...] — an open list since
  -- extra-equipment pricing has no fixed taxonomy across pilots.
  equipment_rates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table pilot_pricing enable row level security;

create trigger pilot_pricing_set_updated_at
  before update on pilot_pricing
  for each row execute function set_updated_at();

create policy "Pilots manage their own pricing"
  on pilot_pricing for all
  using (pilot_id = auth.uid())
  with check (pilot_id = auth.uid());

create policy "Dispatcher admins read all pricing"
  on pilot_pricing for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------

create table portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  pilot_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index portfolio_items_pilot_id_idx on portfolio_items (pilot_id, sort_order);

alter table portfolio_items enable row level security;

create policy "Pilots manage their own portfolio items"
  on portfolio_items for all
  using (pilot_id = auth.uid())
  with check (pilot_id = auth.uid());

create policy "Org accounts and admins read portfolio items"
  on portfolio_items for select
  using (current_org_id() is not null or is_dispatcher_admin());

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', false)
on conflict (id) do nothing;

create policy "Pilots manage their own portfolio files"
  on storage.objects for all
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Org accounts and admins view portfolio files"
  on storage.objects for select
  using (bucket_id = 'portfolio' and (current_org_id() is not null or is_dispatcher_admin()));
-- ---------- END 0061_pilot_pricing_and_portfolio.sql ----------

-- ---------- START 0062_marketplace_bookings.sql ----------
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
  -- afterwards (see 0064) without reworking flight_requests' single-owner
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
-- ---------- END 0062_marketplace_bookings.sql ----------

-- ---------- START 0063_booking_chat.sql ----------
-- In-app chat for a booking, opened once the pilot accepts the invitation
-- (status leaves 'invited') so contact details never need to be exchanged
-- outside the platform. Dispatcher admins get read access ("בקרה ראשית")
-- for oversight — same reasoning as the pilot_reviews/contact_requests admin
-- policies already in 0049 — everyone else only sees threads they're in.

create table booking_messages (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references marketplace_bookings (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default timezone('utc', now())
);

create index booking_messages_booking_id_idx on booking_messages (booking_id, created_at);

alter table booking_messages enable row level security;

create policy "Participants and admins read booking messages"
  on booking_messages for select
  using (
    is_dispatcher_admin()
    or exists (
      select 1 from marketplace_bookings b
      where b.id = booking_messages.booking_id
        and (b.pilot_id = auth.uid() or b.org_id = current_org_id())
    )
  );

create policy "Participants send booking messages once negotiation is open"
  on booking_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from marketplace_bookings b
      where b.id = booking_messages.booking_id
        and b.status not in ('invited', 'declined')
        and (b.pilot_id = auth.uid() or b.org_id = current_org_id())
    )
  );

create or replace function notify_and_log_booking_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  b marketplace_bookings%rowtype;
  sender_name text;
  target_user uuid;
begin
  select * into b from marketplace_bookings where id = new.booking_id;

  insert into app_events (actor_id, org_id, event_name, entity_type, entity_id, metadata)
  values (new.sender_id, b.org_id, 'booking.message_sent', 'marketplace_booking', b.id, jsonb_build_object('message_id', new.id));

  select full_name into sender_name from profiles where id = new.sender_id;
  target_user := case when new.sender_id = b.pilot_id then b.created_by else b.pilot_id end;

  insert into notifications (user_id, kind, title, body, metadata)
  values (
    target_user,
    'booking_message_received',
    'הודעה חדשה בצ׳אט העבודה',
    coalesce(sender_name, 'צד שני') || ': ' || left(new.body, 80),
    jsonb_build_object('booking_id', b.id, 'message_id', new.id)
  );

  return new;
end;
$$;

create trigger booking_messages_notify_and_log
  after insert on booking_messages
  for each row execute function notify_and_log_booking_message();
-- ---------- END 0063_booking_chat.sql ----------

-- ---------- START 0064_booking_flight_association.sql ----------
-- Once a booking is confirmed (0060 generates a short-lived association_code
-- at that point), either side may need a flight_request to be visible to
-- both the pilot and the hiring org — e.g. the org supplies the drone and
-- coordinates the area, so they need to see the request the pilot files for
-- it. flight_requests keeps its existing single-owner shape (user_id); this
-- only adds an optional link plus read access for the linked org. A real
-- calendar sync is future work — this is the v1 bridge.

alter table flight_requests
  add column if not exists booking_id uuid references marketplace_bookings (id) on delete set null;

create index flight_requests_booking_id_idx on flight_requests (booking_id) where booking_id is not null;

create policy "Org members read flight requests linked to their bookings"
  on flight_requests for select
  using (
    booking_id is not null
    and exists (select 1 from marketplace_bookings b where b.id = flight_requests.booking_id and b.org_id = current_org_id())
  );

create or replace function link_flight_request_to_booking(target_flight_request_id uuid, code text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  b marketplace_bookings%rowtype;
  fr flight_requests%rowtype;
begin
  select * into b from marketplace_bookings
    where association_code = upper(trim(code))
      and status = 'confirmed'
      and association_expires_at > timezone('utc', now());
  if not found then
    raise exception 'קוד השיוך אינו תקין או שפג תוקפו';
  end if;

  if auth.uid() <> b.pilot_id and not is_same_org(b.org_id) and not is_dispatcher_admin() then
    raise exception 'אין הרשאה להשתמש בקוד שיוך זה';
  end if;

  select * into fr from flight_requests where id = target_flight_request_id;
  if not found then
    raise exception 'בקשת הטיסה לא נמצאה';
  end if;

  if fr.user_id <> auth.uid() and not is_same_org(b.org_id) and not is_dispatcher_admin() then
    raise exception 'אין הרשאה לשייך בקשת טיסה זו';
  end if;

  update flight_requests set booking_id = b.id where id = target_flight_request_id;
end;
$$;
-- ---------- END 0064_booking_flight_association.sql ----------

-- ---------- START 0065_chat_phrase_analytics.sql ----------
-- Recurring-problem detection across booking chats — deliberately NOT an
-- LLM call per message. A daily job (src/app/api/cron/analyze-chat-phrases)
-- tokenizes new booking_messages, extracts 3-5 word n-grams, and upserts
-- counts here; the admin screen surfaces phrases that repeat across many
-- distinct bookings (e.g. "זה יקר לי מדי") as a recurring-issue signal.
-- Written only by the cron job's service-role client (bypasses RLS, same as
-- the license-expiry sweep) — the policy below is just for the admin read.

create table chat_phrase_stats (
  id uuid primary key default uuid_generate_v4(),
  phrase text not null,
  phrase_length smallint not null,
  occurrence_count integer not null default 0,
  conversation_count integer not null default 0,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique (phrase, phrase_length)
);

alter table chat_phrase_stats enable row level security;

create policy "Dispatcher admins read chat phrase stats"
  on chat_phrase_stats for select
  using (is_dispatcher_admin());

create function admin_recurring_chat_phrases(min_conversations int default 3, limit_count int default 50)
returns table (
  phrase text,
  phrase_length smallint,
  occurrence_count integer,
  conversation_count integer,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_dispatcher_admin() then
    raise exception 'Admins only';
  end if;

  return query
    select cps.phrase, cps.phrase_length, cps.occurrence_count, cps.conversation_count, cps.last_seen_at
    from chat_phrase_stats cps
    where cps.conversation_count >= min_conversations
    order by cps.conversation_count desc, cps.occurrence_count desc
    limit limit_count;
end;
$$;

create function admin_marketplace_bookings_overview()
returns table (status booking_status, booking_count bigint)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_dispatcher_admin() then
    raise exception 'Admins only';
  end if;

  return query
    select b.status, count(*) from marketplace_bookings b group by b.status;
end;
$$;
-- ---------- END 0065_chat_phrase_analytics.sql ----------

-- ---------- START 0066_get_marketplace_booking.sql ----------
-- Single-booking read for the chat screen. my_marketplace_bookings() (0062)
-- only returns bookings the caller is a participant in; the admin
-- monitoring screen ("בקרה ראשית") needs to open any one booking's chat by
-- id, so this is the same shape gated by participant-or-admin instead.

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
    where b.id = target_booking_id
      and (b.pilot_id = auth.uid() or b.org_id = current_org_id() or is_dispatcher_admin());
end;
$$;
-- ---------- END 0066_get_marketplace_booking.sql ----------

-- ---------- START 0067_booking_job_details.sql ----------
-- The booking invitation dialog only had two free-text fields (title,
-- description) forcing the org to type location/price/drone
-- type/purpose as prose buried in the description. Splitting these into
-- their own columns lets the client render them as quick selects instead
-- of open text, and lets the pilot see them at a glance before opening the
-- chat. All nullable — this is the *proposal*, still negotiable in chat,
-- not a locked-in spec.

alter table marketplace_bookings
  add column location text,
  add column budget_ils numeric(10, 2),
  add column operation_type text,
  add column drone_type text,
  add column purpose text;

alter table marketplace_bookings
  add constraint marketplace_bookings_budget_non_negative check (budget_ils is null or budget_ils >= 0);

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

create or replace function get_marketplace_booking(target_booking_id uuid)
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
-- ---------- END 0067_booking_job_details.sql ----------
