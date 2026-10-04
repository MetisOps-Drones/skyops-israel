-- Two things a coordinator needs to judge a request that the form never asked:
--   * camera_type: what the camera can actually see (straight down / forward /
--     area survey) -- matters as much as where the drone is, especially near
--     bases.
--   * takedown_response_seconds: how long the pilot needs to bring the drone
--     down once the coordinator/ATC asks ("מהרגע שעלתה הבקשה"), entered by the
--     pilot.
-- Flight altitude needs no column: max_altitude_meters already stores it (the
-- form used to offer three coarse bands that mapped onto it; it now takes
-- meters directly). Nullable so every existing request stays valid -- the
-- server action requires both for new/edited requests.
-- Idempotent: safe to re-run.
alter table flight_requests
  add column if not exists camera_type text,
  add column if not exists takedown_response_seconds integer;

alter table flight_requests
  drop constraint if exists flight_requests_camera_type_check;
alter table flight_requests
  add constraint flight_requests_camera_type_check
  check (camera_type is null or camera_type in ('vertical', 'horizontal', 'aerial_survey', 'none'));

alter table flight_requests
  drop constraint if exists flight_requests_takedown_response_seconds_check;
alter table flight_requests
  add constraint flight_requests_takedown_response_seconds_check
  check (takedown_response_seconds is null or (takedown_response_seconds between 5 and 3600));

comment on column flight_requests.camera_type is
  'vertical | horizontal | aerial_survey | none -- what the pilot''s camera is aimed at, shown to the dispatcher.';
comment on column flight_requests.takedown_response_seconds is
  'Pilot-declared seconds needed to land the drone after a takedown request from the coordinator/ATC.';
