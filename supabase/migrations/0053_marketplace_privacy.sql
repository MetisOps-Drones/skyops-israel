-- A pilot's עוסק מורשה/עוסק פטור number is required for them to run their own
-- business (invoicing, tax reporting) but was being returned — and
-- displayed — to every org browsing the marketplace, exactly like the phone
-- number problem 0049 already fixed for phone. Same treatment: drop it from
-- both marketplace-facing RPCs. It stays on `profiles` and fully visible to
-- the pilot themself in their own settings — this only removes it from what
-- *other* accounts can see through the marketplace.

drop function if exists marketplace_freelancers(text[]);

create function marketplace_freelancers(eligible_plan_codes text[])
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  business_hours jsonb,
  professional_category text,
  is_verified_pilot boolean,
  avg_rating numeric,
  review_count int,
  my_contact_request_status contact_request_status,
  headline text,
  years_experience int,
  specializations text[],
  skills text[],
  service_areas text[]
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
      p.business_hours,
      p.professional_category,
      p.is_verified_pilot,
      r.avg_rating,
      coalesce(r.review_count, 0)::int,
      cr.status,
      pp.headline,
      pp.years_experience,
      coalesce(pp.specializations, '{}'),
      coalesce(pp.skills, '{}'),
      coalesce(pp.service_areas, '{}')
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

drop function if exists get_marketplace_pilot_profile(uuid);

create function get_marketplace_pilot_profile(target_pilot_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
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
  specializations text[],
  service_areas text[]
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
      coalesce(pp.specializations, '{}'),
      coalesce(pp.service_areas, '{}')
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
