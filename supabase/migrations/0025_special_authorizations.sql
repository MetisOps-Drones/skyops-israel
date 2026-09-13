-- Special-authorization catalog + per-user purchases, backing the "special
-- operation authorization" gate: hobby/pro-freelancer accounts are blocked
-- from submitting a coordination request inside an AIP reference zone (or
-- within 2km of an airport CTR/ATZ) unless their org holds the matching
-- authorization; organizations can submit anyway under a stricter review
-- flow. The catalog starts empty on purpose — these are real regulatory
-- permit categories and must be populated with real names/prices/files by
-- an admin, not invented here.

create table special_authorization_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text not null,
  price_ils numeric(10, 2) not null,
  file_url text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger special_authorization_types_set_updated_at
  before update on special_authorization_types
  for each row execute function set_updated_at();

create type special_authorization_status as enum ('pending_payment', 'active', 'expired');

create table user_special_authorizations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  authorization_type_id uuid not null references special_authorization_types (id) on delete restrict,
  status special_authorization_status not null default 'pending_payment',
  purchased_at timestamptz,
  file_delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index user_special_authorizations_user_id_idx on user_special_authorizations (user_id);

alter table special_authorization_types enable row level security;
alter table user_special_authorizations enable row level security;

create policy "Authenticated users read the active authorization catalog"
  on special_authorization_types for select
  to authenticated
  using (active = true);

create policy "Users read their own special authorizations"
  on user_special_authorizations for select
  using (user_id = auth.uid());

create policy "Users purchase their own special authorizations"
  on user_special_authorizations for insert
  with check (user_id = auth.uid());

create policy "Org members read teammates' special authorizations"
  on user_special_authorizations for select
  using (
    exists (
      select 1 from profiles p
      where p.id = user_special_authorizations.user_id
        and p.org_id is not null
        and p.org_id = current_org_id()
    )
  );
