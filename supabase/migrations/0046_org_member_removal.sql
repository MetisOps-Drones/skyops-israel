-- Org member removal was a defined-but-unused enum value ('removed' on
-- org_membership_status, added in 0014) with no code path ever setting it:
-- fleet managers could approve/reject join requests but had no way to see
-- their active roster or remove someone from it. This adds both.

-- Mirrors handle_membership_approved(): when a membership is removed, drop
-- the person out of that org's *active context* if that's where they were
-- pointed, the same way approval auto-points them into it.
create or replace function handle_membership_removed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'removed' and old.status is distinct from 'removed' then
    update profiles
    set org_id = null
    where id = new.user_id and org_id = new.org_id;
  end if;
  return new;
end;
$$;

create trigger organization_members_handle_removal
  after update of status on organization_members
  for each row execute function handle_membership_removed();

-- Guard against an org being left with no one able to manage it.
create or replace function prevent_removing_last_fleet_manager()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'removed'
    and old.status = 'active'
    and old.role = 'fleet_manager'
    and not exists (
      select 1 from organization_members
      where org_id = old.org_id
        and user_id <> old.user_id
        and status = 'active'
        and role = 'fleet_manager'
    )
  then
    raise exception 'Cannot remove the last active fleet manager of an organization';
  end if;
  return new;
end;
$$;

create trigger organization_members_prevent_last_manager_removal
  before update of status on organization_members
  for each row execute function prevent_removing_last_fleet_manager();

-- The decision-notification trigger only ever fired for active/rejected —
-- extend it to also tell someone when they've been removed.
create or replace function notify_org_membership_decided()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  org_name text;
begin
  if new.status = old.status or new.status not in ('active', 'rejected', 'removed') then
    return new;
  end if;

  select name into org_name from organizations where id = new.org_id;

  insert into notifications (user_id, kind, title, body, metadata)
  values (
    new.user_id,
    'org_membership_decided',
    case
      when new.status = 'active' then 'הבקשה אושרה'
      when new.status = 'rejected' then 'הבקשה נדחתה'
      else 'הוסרת מהארגון'
    end,
    case
      when new.status = 'active' then 'הצטרפתם ל-' || coalesce(org_name, 'הארגון') || ' בתפקיד ' || coalesce(new.role::text, '')
      when new.status = 'rejected' then 'הבקשה להצטרף ל-' || coalesce(org_name, 'הארגון') || ' נדחתה'
      else 'הוסרתם מ-' || coalesce(org_name, 'הארגון')
    end,
    jsonb_build_object('org_id', new.org_id, 'status', new.status)
  );

  return new;
end;
$$;
