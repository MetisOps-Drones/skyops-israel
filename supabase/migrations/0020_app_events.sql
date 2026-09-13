-- Phase 4: a single events table that serves two purposes at once —
-- an operational audit trail (who did what, when, to which record) and the
-- raw material for product analytics (usage patterns, active users, which
-- features actually get touched). Business-state changes are logged
-- automatically by triggers below; UI-level events (page views, feature
-- clicks) are inserted directly by the client via trackEvent().

create table app_events (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles (id) on delete set null,
  org_id uuid references organizations (id) on delete set null,
  event_name text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index app_events_event_name_created_at_idx on app_events (event_name, created_at desc);
create index app_events_actor_id_created_at_idx on app_events (actor_id, created_at desc);
create index app_events_org_id_created_at_idx on app_events (org_id, created_at desc);

alter table app_events enable row level security;

-- Client-side analytics events: a user can log their own.
create policy "Users insert their own events"
  on app_events for insert
  with check (actor_id = auth.uid());

create policy "Users read their own events"
  on app_events for select
  using (actor_id = auth.uid());

create policy "Fleet managers read their org's events"
  on app_events for select
  using (org_id is not null and is_org_fleet_manager(org_id));

create policy "Dispatcher admins read every event"
  on app_events for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- Audit triggers: the business events worth remembering, logged server-side
-- so they can't be skipped or spoofed by the client.
-- ---------------------------------------------------------------------------

create or replace function log_flight_request_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into app_events (actor_id, event_name, entity_type, entity_id, metadata)
  values (
    new.user_id,
    'flight_request.' || new.status,
    'flight_request',
    new.id,
    jsonb_build_object('request_type', new.request_type, 'drone_id', new.drone_id)
  );
  return new;
end;
$$;

create trigger flight_requests_log_event
  after insert or update of status on flight_requests
  for each row execute function log_flight_request_event();

create or replace function log_membership_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into app_events (actor_id, org_id, event_name, entity_type, metadata)
    values (new.user_id, new.org_id, 'membership.requested', 'organization_member', jsonb_build_object('user_id', new.user_id));
  elsif new.status is distinct from old.status then
    insert into app_events (actor_id, org_id, event_name, entity_type, metadata)
    values (
      coalesce(new.decided_by, new.user_id),
      new.org_id,
      'membership.' || new.status,
      'organization_member',
      jsonb_build_object('user_id', new.user_id, 'role', new.role)
    );
  end if;
  return new;
end;
$$;

create trigger organization_members_log_event
  after insert or update of status on organization_members
  for each row execute function log_membership_event();

create or replace function log_handoff_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_org_id uuid;
begin
  select org_id into target_org_id from drones where id = new.drone_id;

  if tg_op = 'INSERT' then
    insert into app_events (actor_id, org_id, event_name, entity_type, entity_id, metadata)
    values (new.user_id, target_org_id, 'equipment.checked_out', 'drone', new.drone_id, jsonb_build_object('condition', new.checked_out_condition));
  elsif new.status = 'returned' and old.status is distinct from 'returned' then
    insert into app_events (actor_id, org_id, event_name, entity_type, entity_id, metadata)
    values (new.user_id, target_org_id, 'equipment.returned', 'drone', new.drone_id, jsonb_build_object('condition', new.checked_in_condition));
  end if;
  return new;
end;
$$;

create trigger equipment_handoffs_log_event
  after insert or update of status on equipment_handoffs
  for each row execute function log_handoff_event();

create or replace function log_license_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or (new.status is distinct from old.status) then
    insert into app_events (actor_id, event_name, entity_type, entity_id, metadata)
    values (new.user_id, 'license.' || new.status, 'pilot_license', new.id, jsonb_build_object('license_type', new.license_type));
  end if;
  return new;
end;
$$;

create trigger pilot_licenses_log_event
  after insert or update of status on pilot_licenses
  for each row execute function log_license_event();
