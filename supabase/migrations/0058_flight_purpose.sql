-- Design-partner audit (control-center round) flagged that a coordination
-- request never records *why* the flight is happening — every request looks
-- identical to the dispatcher regardless of whether it's a photo shoot or a
-- BVLOS agricultural spray run. This adds a flight-purpose classification to
-- the request form: VLOS/BVLOS operation type alongside a set of real-world
-- job categories, so the request itself, the NOTAM, and future analytics
-- can all reflect what's actually being flown.

create type flight_purpose as enum (
  'vlos_general',
  'bvlos',
  'photography',
  'mapping_survey',
  'agriculture_spraying',
  'infrastructure_inspection',
  'event_production',
  'delivery',
  'search_and_rescue',
  'training',
  'other'
);

alter table flight_requests
  add column if not exists flight_purpose flight_purpose not null default 'vlos_general';
