-- find_coordination_authority() returned every matching row with no
-- ordering at all — for a point near a major base or a national body's
-- 200km-radius entry (most of coordination_authorities: every רש"ת/רת"א
-- row is centered on Tel Aviv with radius_m = 200000, matching almost
-- anywhere in Israel), that meant a dispatcher could get a dozen
-- unranked phone numbers for one point with no signal on which to call
-- first.
--
-- Ranking, researched against each org's real-world role:
--   1. Actual local airspace gatekeepers — base control towers, civil
--      airports/CTRs, private airfields, border security units (מב"א).
--   2. Regional courtesy/security coordination — municipalities,
--      nature-reserve districts (רט"ג).
--   3. רש"ת's national AIS/ARO/service-center desks — the real fallback
--      NOTAM/flight-info contact.
--   4. Environmental/advisory bodies (עמותה, קק"ל).
--   5. רת"א departments — regulatory/licensing, essentially never the
--      right "who do I call about today's flight" contact.
-- Within the same tier, the smaller radius_m row (more specific match)
-- sorts first.
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
    radius_m asc;
$$;
