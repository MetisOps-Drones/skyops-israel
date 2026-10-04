-- A sport/leisure pilot (מטיסן) may fly within 150 m of infrastructure (a building, a populated area) in two cases the
-- regulations name: the owner of the infrastructure agreed (or it is the pilot's own), or the drone is a "טיסן זעיר"
-- (250 g or less) flown under the regulation's conditions. The pilot declares which one when submitting; the declaration
-- is kept on the request so the coordinator sees what was claimed.
--   owner_consent           the owner/holder of the infrastructure agreed, or it belongs to the pilot
--   micro_drone_conditions  the drone is 250 g or less, has no exposed moving parts, and will not hover over people/vehicles
-- Nullable: most requests never need it. Idempotent: safe to re-run.
alter table flight_requests
  add column if not exists infrastructure_declaration text;

alter table flight_requests
  drop constraint if exists flight_requests_infrastructure_declaration_check;
alter table flight_requests
  add constraint flight_requests_infrastructure_declaration_check
  check (infrastructure_declaration is null or infrastructure_declaration in ('owner_consent', 'micro_drone_conditions'));

comment on column flight_requests.infrastructure_declaration is
  'owner_consent | micro_drone_conditions -- the sport/leisure pilot''s declaration for flying within 150 m of infrastructure, shown to the dispatcher.';
