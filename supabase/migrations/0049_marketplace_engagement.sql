-- Marketplace v1 exposed a freelancer's raw phone number to any org member
-- who could see their card: 0039's "Org members read marketplace-visible
-- freelancer profiles" policy grants the *whole* profile row (RLS is
-- row-level only — Postgres has no column-level RLS), and the client just
-- happened not to render every column it received. This migration:
--   1. Replaces that browse path with a security-definer function that
--      never selects phone at all.
--   2. Adds a contact-request flow: an org asks to be put in touch with a
--      pilot; only once the pilot accepts does the org get the phone
--      number (via get_pilot_contact_phone()).
--   3. Adds ratings/reviews, restricted to orgs with an accepted contact
--      request for that pilot — no drive-by reviews.
--   4. Adds an admin-settable "verified pilot" badge.

drop policy "Org members read marketplace-visible freelancer profiles" on profiles;

alter table profiles
  add column if not exists is_verified_pilot boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references profiles (id) on delete set null;

-- No prior policy let anyone but the row owner update a profile — needed so
-- dispatcher_admin can set the verified badge from the new admin screen.
create policy "Dispatcher admins update any profile"
  on profiles for update
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

alter type notification_kind add value 'contact_request_received';
alter type notification_kind add value 'contact_request_decided';
alter type notification_kind add value 'pilot_review_received';

-- ---------------------------------------------------------------------------
-- Contact requests
-- ---------------------------------------------------------------------------

create type contact_request_status as enum ('pending', 'accepted', 'declined');

create table contact_requests (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations (id) on delete cascade,
  requested_by uuid not null references profiles (id) on delete cascade,
  pilot_id uuid not null references profiles (id) on delete cascade,
  status contact_request_status not null default 'pending',
  message text,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index contact_requests_pilot_id_idx on contact_requests (pilot_id);
create index contact_requests_org_id_idx on contact_requests (org_id);
-- Only one *open* request per org/pilot pair — a declined request can be retried later.
create unique index contact_requests_pending_unique on contact_requests (org_id, pilot_id) where status = 'pending';

alter table contact_requests enable row level security;

create policy "Org members request contact with a freelancer"
  on contact_requests for insert
  with check (org_id = current_org_id() and requested_by = auth.uid());

create policy "Org members read their own org's contact requests"
  on contact_requests for select
  using (org_id = current_org_id());

create policy "Pilots read contact requests addressed to them"
  on contact_requests for select
  using (pilot_id = auth.uid());

create policy "Pilots decide on their own contact requests"
  on contact_requests for update
  using (pilot_id = auth.uid())
  with check (pilot_id = auth.uid());

create policy "Dispatcher admins manage all contact requests"
  on contact_requests for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

create or replace function notify_contact_request_received()
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
    'contact_request_received',
    'בקשת יצירת קשר חדשה',
    coalesce(org_name, 'ארגון') || ' רוצה ליצור איתך קשר דרך המרקטפלייס',
    jsonb_build_object('contact_request_id', new.id, 'org_id', new.org_id)
  );
  return new;
end;
$$;

create trigger contact_requests_notify_received
  after insert on contact_requests
  for each row execute function notify_contact_request_received();

create or replace function notify_contact_request_decided()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pilot_name text;
begin
  if new.status = old.status or new.status not in ('accepted', 'declined') then
    return new;
  end if;

  select full_name into pilot_name from profiles where id = new.pilot_id;

  insert into notifications (user_id, kind, title, body, metadata)
  values (
    new.requested_by,
    'contact_request_decided',
    case when new.status = 'accepted' then 'הבקשה אושרה' else 'הבקשה נדחתה' end,
    case
      when new.status = 'accepted' then coalesce(pilot_name, 'המטיס') || ' אישר/ה את בקשת יצירת הקשר — פרטי הקשר זמינים כעת'
      else coalesce(pilot_name, 'המטיס') || ' דחה/תה את בקשת יצירת הקשר'
    end,
    jsonb_build_object('contact_request_id', new.id, 'pilot_id', new.pilot_id, 'status', new.status)
  );

  return new;
end;
$$;

create trigger contact_requests_notify_decided
  after update of status on contact_requests
  for each row execute function notify_contact_request_decided();

-- ---------------------------------------------------------------------------
-- Pilot reviews — one per org/pilot pair, editable, gated on having actually
-- been introduced (an accepted contact request).
-- ---------------------------------------------------------------------------

create table pilot_reviews (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations (id) on delete cascade,
  reviewer_id uuid not null references profiles (id) on delete cascade,
  pilot_id uuid not null references profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (org_id, pilot_id)
);

create index pilot_reviews_pilot_id_idx on pilot_reviews (pilot_id);

alter table pilot_reviews enable row level security;

create policy "Org accounts and the reviewed pilot read reviews"
  on pilot_reviews for select
  using (current_org_id() is not null or pilot_id = auth.uid() or is_dispatcher_admin());

create policy "Orgs with an accepted contact request review the pilot"
  on pilot_reviews for insert
  with check (
    org_id = current_org_id()
    and reviewer_id = auth.uid()
    and exists (
      select 1 from contact_requests cr
      where cr.org_id = pilot_reviews.org_id
        and cr.pilot_id = pilot_reviews.pilot_id
        and cr.status = 'accepted'
    )
  );

create policy "Orgs edit their own review"
  on pilot_reviews for update
  using (org_id = current_org_id() and reviewer_id = auth.uid())
  with check (org_id = current_org_id() and reviewer_id = auth.uid());

create policy "Dispatcher admins manage all reviews"
  on pilot_reviews for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

create or replace function notify_pilot_review_received()
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
    'pilot_review_received',
    'קיבלת דירוג חדש',
    coalesce(org_name, 'ארגון') || ' דירג/ה אותך ' || new.rating || ' מתוך 5',
    jsonb_build_object('pilot_review_id', new.id, 'org_id', new.org_id, 'rating', new.rating)
  );
  return new;
end;
$$;

create trigger pilot_reviews_notify_insert
  after insert on pilot_reviews
  for each row execute function notify_pilot_review_received();

-- ---------------------------------------------------------------------------
-- Marketplace browse + phone reveal, both security definer so browsing
-- never needs (and the phone reveal never grants beyond) exactly what's
-- checked here.
-- ---------------------------------------------------------------------------

create or replace function marketplace_freelancers(eligible_plan_codes text[])
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  business_id text,
  business_hours jsonb,
  professional_category text,
  is_verified_pilot boolean,
  avg_rating numeric,
  review_count int,
  my_contact_request_status contact_request_status
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if current_org_id() is null and not is_dispatcher_admin() then
    raise exception 'Marketplace is available to organization accounts only';
  end if;

  return query
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.bio,
      p.business_id,
      p.business_hours,
      p.professional_category,
      p.is_verified_pilot,
      r.avg_rating,
      coalesce(r.review_count, 0)::int,
      cr.status
    from profiles p
    left join (
      select pilot_id, avg(rating)::numeric(3, 2) as avg_rating, count(*)::int as review_count
      from pilot_reviews
      group by pilot_id
    ) r on r.pilot_id = p.id
    left join contact_requests cr on cr.pilot_id = p.id and cr.org_id = current_org_id()
    where p.role = 'pilot_pro'
      and p.freelance_available = true
      and p.plan_code = any (eligible_plan_codes)
    order by p.full_name;
end;
$$;

create or replace function get_pilot_contact_phone(target_pilot_id uuid)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result text;
begin
  if not is_dispatcher_admin() and not exists (
    select 1 from contact_requests
    where pilot_id = target_pilot_id
      and status = 'accepted'
      and org_id = current_org_id()
  ) then
    raise exception 'No accepted contact request with this pilot yet';
  end if;

  select phone into result from profiles where id = target_pilot_id;
  return result;
end;
$$;
