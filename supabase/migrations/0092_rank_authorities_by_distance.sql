-- find_coordination_authority() ranked by tier, then by the *smaller radius*
-- (0084). Two same-tier authorities with the same radius -- an air force base
-- tower and a private airstrip, both radius_m = 10000 -- tied and came back in
-- arbitrary order: at the Hatzerim runway the first suggested contact was the
-- Sde Teiman airstrip instead of the Hatzerim tower, and at Ramat David it was
-- the Megiddo airstrip. Within a tier the authority whose own location is
-- closest to the point now comes first (the base tower sits on the base), with
-- the smaller radius only as a tie-break. Tiers are unchanged.
-- Idempotent: create or replace.
create or replace function find_coordination_authority(lng double precision, lat double precision)
returns setof coordination_authorities
language sql
stable
as $$
  select *
  from coordination_authorities
  where st_dwithin(
    geography(st_setsrid(st_makepoint(center_lng, center_lat), 4326)),
    geography(st_setsrid(st_makepoint(lng, lat), 4326)),
    radius_m
  )
  order by
    case unit_type
      when 'חיל האוויר' then 1
      when 'שדה תעופה אזרחי' then 1
      when 'מנחת פרטי' then 1
      when 'מב"א' then 1
      when 'רשות מקומית' then 2
      when 'רט"ג' then 2
      when 'רש"ת' then 3
      when 'עמותה' then 4
      when 'קק"ל' then 4
      when 'רת"א' then 5
      else 6
    end,
    st_distance(
      geography(st_setsrid(st_makepoint(center_lng, center_lat), 4326)),
      geography(st_setsrid(st_makepoint(lng, lat), 4326))
    ) asc,
    radius_m asc;
$$;
