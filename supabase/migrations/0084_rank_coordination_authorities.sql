-- find_coordination_authority() returned every matching row with no
-- ordering at all — for a point near a major base or a national body's
-- 200km-radius entry (most of coordination_authorities: every רש"ת/רת"א
-- row is centered on Tel Aviv with radius_m = 200000, matching almost
-- anywhere in Israel), that meant a dispatcher could get a dozen
-- unranked phone numbers for one point with no signal on which to call
-- first — CoordinationPanel already implicitly treats index 0 as "the"
-- authority when a dispatcher hasn't picked one explicitly
-- (authority_id: coordination?.authority_id ?? authorities[0]?.id), so
-- an unordered result was silently picking an arbitrary one.
--
-- Ranking, researched against each org's actual real-world role (see
-- session notes — CAAI/רת"א's own site describes it as the regulatory/
-- licensing body, not per-flight operational coordination; רש"ת's
-- AIS/ARO desks are the real national NOTAM/flight-briefing point of
-- contact):
--   1. Actual airspace gatekeepers for their own local area — a base's
--      control tower, a civil airport/CTR, a private airfield, a border
--      security unit (מב"א). These are who genuinely grants or denies
--      access near their own location.
--   2. Regional courtesy/security coordination — local municipalities,
--      nature-reserve districts (רט"ג). Real, but secondary to an actual
--      airspace authority when both match.
--   3. רש"ת's national AIS/ARO/service-center desks — the real fallback
--      NOTAM/flight-info contact when nothing more local applies.
--   4. Environmental/advisory bodies (עמותה, קק"ל) — worth notifying,
--      not who clears a flight.
--   5. רת"א departments — regulatory/licensing (permits, certification,
--      exams), essentially never the right "who do I call about today's
--      flight" contact, but kept in the list since a request sometimes
--      genuinely is a licensing/import question.
-- Within the same tier, the smaller radius_m row is the more specific
-- match and sorts first.
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
