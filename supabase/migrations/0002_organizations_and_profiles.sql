-- Organizations back fleet_manager accounts that own shared drones/pilots.
-- A solo pilot never needs one; org_id stays null for them.

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references organizations (id) on delete set null,
  full_name text not null,
  phone text,
  role user_role not null default 'pilot_hobby',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create table organization_members (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  added_at timestamptz not null default timezone('utc', now()),
  primary key (org_id, user_id)
);

-- Auto-create a profile row whenever a new Supabase auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Pilot'),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'pilot_hobby')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper predicates used throughout the RLS policies in 0010_rls_policies.sql.
create or replace function is_dispatcher_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'dispatcher_admin'
  );
$$;

create or replace function current_org_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select org_id from profiles where id = auth.uid();
$$;

create or replace function is_same_org(target_org_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target_org_id is not null and target_org_id = current_org_id();
$$;
