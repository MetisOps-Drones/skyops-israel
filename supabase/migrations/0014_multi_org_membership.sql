-- Multi-organization membership for freelance/pro pilots.
--
-- Until now `profiles.org_id` was the single source of truth for org
-- affiliation (one person, at most one org, ever). That's wrong for a
-- freelance pilot who contracts for several drone companies. This migration:
--   1. Turns `organization_members` into a real request/approval workflow
--      (pending -> active/rejected), with a role scoped to *that* membership.
--   2. Keeps `profiles.org_id` as the user's *currently active* org context
--      (which fleet/roster they're currently looking at), but only lets it
--      point at an org where they hold an active membership.
--   3. Moves fleet-manager authorization from the global `profiles.role`
--      to the per-membership role, so a person can be a fleet manager in one
--      org and a plain contractor pilot in another.
--   4. Tightens drone ownership to true either/or (never both, never neither).
--   5. Adds an invite-code lookup so a freelancer can find an org to request
--      joining without organizations being publicly browsable/listable.

-- ---------------------------------------------------------------------------
-- 1. organization_members: pending -> active/rejected/removed workflow
-- ---------------------------------------------------------------------------

create type org_membership_status as enum ('pending', 'active', 'rejected', 'removed');

alter table organization_members
  add column role user_role,
  add column status org_membership_status not null default 'pending',
  add column decided_at timestamptz,
  add column decided_by uuid references profiles (id) on delete set null;

create index organization_members_user_id_idx on organization_members (user_id);
create index organization_members_status_idx on organization_members (org_id, status);

comment on column organization_members.added_at is
  'When the membership row was created (i.e. when the join request was submitted).';
comment on column organization_members.role is
  'Role granted for *this* org only, set by the org when it approves the request. Null while pending.';

-- ---------------------------------------------------------------------------
-- 2. Org-scoped fleet-manager check (replaces relying on profiles.role,
--    which is a single global value and can't express "manager in org A,
--    contractor in org B").
-- ---------------------------------------------------------------------------

create or replace function is_org_fleet_manager(target_org_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where org_id = target_org_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'fleet_manager'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. profiles.org_id becomes a *switchable pointer* into active memberships,
--    validated by trigger rather than assumed correct.
-- ---------------------------------------------------------------------------

create or replace function validate_profile_active_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is not null then
    if not exists (
      select 1 from organization_members
      where org_id = new.org_id and user_id = new.id and status = 'active'
    ) then
      raise exception 'Cannot set active organization: no active membership in that organization';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_validate_active_org
  before insert or update of org_id on profiles
  for each row execute function validate_profile_active_org();

-- Auto-switch a freelancer into an org the moment their *first* membership
-- goes active, so they're not stuck on a manual step before they can see
-- anything. Later joins never override an already-chosen active org.
create or replace function handle_membership_approved()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    update profiles
    set org_id = new.org_id
    where id = new.user_id and org_id is null;
  end if;
  return new;
end;
$$;

create trigger organization_members_handle_approval
  after update of status on organization_members
  for each row execute function handle_membership_approved();

-- ---------------------------------------------------------------------------
-- 4. Drone ownership: exactly one of user_id / org_id, never both, never
--    neither. (Previously "at least one", which technically allowed both.)
-- ---------------------------------------------------------------------------

alter table drones drop constraint drone_owner_present;
alter table drones add constraint drone_owner_exclusive check (
  (user_id is not null and org_id is null) or (user_id is null and org_id is not null)
);

-- ---------------------------------------------------------------------------
-- 5. Invite-code lookup: organizations stay private (RLS still scopes them
--    to members + dispatcher admins), but a freelancer can resolve a code
--    they were given out-of-band to an org id/name before requesting to join.
-- ---------------------------------------------------------------------------

alter table organizations
  add column invite_code text
    not null
    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
    unique;

create or replace function find_organization_by_invite_code(code text)
returns table (id uuid, name text)
language sql
stable
security definer set search_path = public
as $$
  select id, name from organizations where invite_code = upper(code);
$$;

-- ---------------------------------------------------------------------------
-- 6. Notifications: tell the org when a join request lands, tell the
--    requester when it's decided.
-- ---------------------------------------------------------------------------

alter type notification_kind add value 'org_membership_requested';
alter type notification_kind add value 'org_membership_decided';

create or replace function notify_org_membership_requested()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  org_name text;
  requester_name text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select name into org_name from organizations where id = new.org_id;
  select full_name into requester_name from profiles where id = new.user_id;

  insert into notifications (user_id, kind, title, body, metadata)
  select
    om.user_id,
    'org_membership_requested',
    'בקשת הצטרפות חדשה',
    coalesce(requester_name, 'טייס') || ' ביקש/ה להצטרף ל-' || coalesce(org_name, 'הארגון'),
    jsonb_build_object('org_id', new.org_id, 'requesting_user_id', new.user_id)
  from organization_members om
  where om.org_id = new.org_id
    and om.status = 'active'
    and om.role = 'fleet_manager';

  return new;
end;
$$;

create trigger organization_members_notify_request
  after insert on organization_members
  for each row execute function notify_org_membership_requested();

create or replace function notify_org_membership_decided()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  org_name text;
begin
  if new.status = old.status or new.status not in ('active', 'rejected') then
    return new;
  end if;

  select name into org_name from organizations where id = new.org_id;

  insert into notifications (user_id, kind, title, body, metadata)
  values (
    new.user_id,
    'org_membership_decided',
    case when new.status = 'active' then 'הבקשה אושרה' else 'הבקשה נדחתה' end,
    case
      when new.status = 'active' then 'הצטרפתם ל-' || coalesce(org_name, 'הארגון') || ' בתפקיד ' || coalesce(new.role::text, '')
      else 'הבקשה להצטרף ל-' || coalesce(org_name, 'הארגון') || ' נדחתה'
    end,
    jsonb_build_object('org_id', new.org_id, 'status', new.status)
  );

  return new;
end;
$$;

create trigger organization_members_notify_decision
  after update of status on organization_members
  for each row execute function notify_org_membership_decided();

-- ---------------------------------------------------------------------------
-- 7. RLS: replace policies that keyed off the old single-org assumption or
--    the global profiles.role for fleet-manager checks.
-- ---------------------------------------------------------------------------

drop policy "Fleet managers update their own organization" on organizations;
create policy "Fleet managers update their own organization"
  on organizations for update
  using (is_org_fleet_manager(id));

drop policy "Fleet managers manage their roster" on organization_members;
create policy "Fleet managers decide on membership requests"
  on organization_members for update
  using (is_org_fleet_manager(org_id))
  with check (is_org_fleet_manager(org_id));

create policy "Dispatcher admins manage all memberships"
  on organization_members for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

create policy "Users read their own memberships"
  on organization_members for select
  using (user_id = auth.uid());

create policy "Users request to join an organization"
  on organization_members for insert
  with check (user_id = auth.uid() and status = 'pending');

drop policy "Fleet managers manage their fleet" on drones;
create policy "Fleet managers manage their fleet"
  on drones for all
  using (org_id is not null and is_org_fleet_manager(org_id))
  with check (org_id is not null and is_org_fleet_manager(org_id));
