-- A "LinkedIn-style" freelancer profile for the marketplace: structured
-- experience (drone models flown, UAV categories, manual flight-mode
-- proficiency, skills, industry software, role specializations) instead of
-- just a name + free-text bio. Reviews already exist (0049) — this just
-- gives orgs enough to actually evaluate a pilot before requesting contact,
-- and gives the marketplace list something real to search/filter on.

create table pilot_profiles (
  id uuid primary key references profiles (id) on delete cascade,
  headline text,
  years_experience int,
  drone_models text[] not null default '{}',
  uav_categories text[] not null default '{}',
  flight_modes text[] not null default '{}',
  skills text[] not null default '{}',
  software text[] not null default '{}',
  specializations text[] not null default '{}',
  updated_at timestamptz not null default timezone('utc', now())
);

alter table pilot_profiles enable row level security;

create policy "Pilots manage their own marketplace profile"
  on pilot_profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- No phone/contact info lives on this table (that stays gated behind
-- get_pilot_contact_phone, 0049) — a plain RLS read policy for any org
-- account is fine, unlike profiles.phone.
create policy "Org accounts read pilot marketplace profiles"
  on pilot_profiles for select
  using (current_org_id() is not null);

create policy "Dispatcher admins read all pilot profiles"
  on pilot_profiles for select
  using (is_dispatcher_admin());

-- Return shape is changing (new columns), so the old function must be
-- dropped before recreating rather than just `create or replace`.
drop function if exists marketplace_freelancers(text[]);

create function marketplace_freelancers(eligible_plan_codes text[])
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
  my_contact_request_status contact_request_status,
  headline text,
  years_experience int,
  specializations text[],
  skills text[]
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
      cr.status,
      pp.headline,
      pp.years_experience,
      coalesce(pp.specializations, '{}'),
      coalesce(pp.skills, '{}')
    from profiles p
    left join (
      select pilot_id, avg(rating)::numeric(3, 2) as avg_rating, count(*)::int as review_count
      from pilot_reviews
      group by pilot_id
    ) r on r.pilot_id = p.id
    left join contact_requests cr on cr.pilot_id = p.id and cr.org_id = current_org_id()
    left join pilot_profiles pp on pp.id = p.id
    where p.role = 'pilot_pro'
      and p.freelance_available = true
      and p.plan_code = any (eligible_plan_codes)
    order by p.full_name;
end;
$$;

create function get_marketplace_pilot_profile(target_pilot_id uuid)
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
  my_contact_request_status contact_request_status,
  headline text,
  years_experience int,
  drone_models text[],
  uav_categories text[],
  flight_modes text[],
  skills text[],
  software text[],
  specializations text[]
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if current_org_id() is null and not is_dispatcher_admin() and auth.uid() <> target_pilot_id then
    raise exception 'Not authorized to view this profile';
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
      cr.status,
      pp.headline,
      pp.years_experience,
      coalesce(pp.drone_models, '{}'),
      coalesce(pp.uav_categories, '{}'),
      coalesce(pp.flight_modes, '{}'),
      coalesce(pp.skills, '{}'),
      coalesce(pp.software, '{}'),
      coalesce(pp.specializations, '{}')
    from profiles p
    left join (
      select pilot_id, avg(rating)::numeric(3, 2) as avg_rating, count(*)::int as review_count
      from pilot_reviews
      group by pilot_id
    ) r on r.pilot_id = p.id
    left join contact_requests cr on cr.pilot_id = p.id and cr.org_id = current_org_id()
    left join pilot_profiles pp on pp.id = p.id
    where p.id = target_pilot_id and p.role = 'pilot_pro';
end;
$$;
