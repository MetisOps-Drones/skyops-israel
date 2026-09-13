-- create_organization_as_owner() unconditionally set role = 'fleet_manager', which would
-- silently downgrade a platform admin (dispatcher_admin, forced by email in handle_new_user() —
-- see migration 0041) back to fleet_manager if they went through the "עסק" branch of the signup
-- wizard. An admin creating/owning an org should stay admin; only bump the role when the caller
-- isn't already dispatcher_admin.
create or replace function create_organization_as_owner(org_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated';
  end if;

  insert into organizations (name) values (org_name) returning id into new_org_id;

  insert into organization_members (org_id, user_id, status, role, decided_at, decided_by)
  values (new_org_id, auth.uid(), 'active', 'fleet_manager', timezone('utc', now()), auth.uid());

  update profiles
  set org_id = new_org_id,
      role = case when role = 'dispatcher_admin' then role else 'fleet_manager' end
  where id = auth.uid();

  return new_org_id;
end;
$$;
