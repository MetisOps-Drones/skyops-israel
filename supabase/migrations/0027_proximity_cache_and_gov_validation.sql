-- 1) Spatial cache for the OSM/Overpass proximity check (0026 gave us the
--    authorization catalog; this speeds up the check added alongside it —
--    src/app/api/proximity-check/route.ts). Neighborhoods/stadiums/etc.
--    don't move, so a coarse grid-cell cache is safe to reuse for a long
--    time — this is NOT the same kind of data as the AIP layer (which
--    already has its own advisory-only caveats); it just avoids re-hitting
--    a shared public API for a point someone already checked nearby.

create table proximity_check_cache (
  grid_key text primary key,
  center_lat double precision not null,
  center_lng double precision not null,
  findings jsonb not null,
  checked_at timestamptz not null default timezone('utc', now())
);

alter table proximity_check_cache enable row level security;

create policy "Authenticated users read the proximity cache"
  on proximity_check_cache for select
  to authenticated
  using (true);

-- Writes go through the service-role client inside the route handler, not
-- through client-side RLS — no insert/update policy needed for regular users.

-- 2) Generic backend scaffold for validating user-submitted regulatory data
--    (drone registration numbers, pilot license numbers, special
--    authorizations) against government systems. No real government API
--    exists to call yet, so every request an admin hasn't wired a provider
--    for sits honestly at 'not_configured' rather than faking a pass.

create type government_validation_entity as enum ('drone_registration', 'pilot_license', 'special_authorization');
create type government_validation_status as enum ('not_configured', 'pending', 'verified', 'rejected', 'error');

create table government_validation_requests (
  id uuid primary key default uuid_generate_v4(),
  entity_type government_validation_entity not null,
  entity_id uuid not null,
  submitted_value text not null,
  status government_validation_status not null default 'not_configured',
  provider text,
  response jsonb,
  requested_by uuid references profiles (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index government_validation_requests_entity_idx
  on government_validation_requests (entity_type, entity_id);

alter table government_validation_requests enable row level security;

create policy "Users read validation requests for their own entities"
  on government_validation_requests for select
  using (requested_by = auth.uid());

create policy "Dispatcher admins read all validation requests"
  on government_validation_requests for select
  using (is_dispatcher_admin());

-- 3) Tie each special-authorization catalog entry to the specific
--    regulation it exempts, so the app can offer the right one inline
--    (e.g. "you're near a residential area — that's regulation 32, flying
--    over a person or infrastructure") instead of a generic prompt.

alter table special_authorization_types
  add column regulation_number text;

update special_authorization_types set regulation_number = 'תקנה 28' where name = 'הסתייעות בתצפיתן';
update special_authorization_types set regulation_number = 'תקנה 25' where name = 'הטסה מכלי תחבורה בתנועה';
update special_authorization_types set regulation_number = 'תקנה 26(ג)' where name = 'הפעלה בדמדומים ובלילה';
update special_authorization_types set regulation_number = 'תקנה 27' where name = 'הפעלה ללא קשר עין ישיר (BVLOS)';
update special_authorization_types set regulation_number = 'תקנה 32' where name = 'הטסה מעל אדם או תשתית';
update special_authorization_types set regulation_number = 'תקנה 35' where name = 'חריג למגבלות הכלליות';
