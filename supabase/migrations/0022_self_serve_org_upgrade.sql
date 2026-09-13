-- Self-serve "upgrade to organization" from the profile page. Direct org
-- creation is a paid tier in the product (enforced client-side via the same
-- demo-paywall pattern as the academy's commercial course — see
-- PaywallScreen); this function is the actual account-mutation step that
-- runs once the user has gone through that gate. It mirrors what a fleet
-- manager join-approval does (0014_multi_org_membership.sql) but skips the
-- pending/approval workflow since the caller is creating their own org.

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

  update profiles set org_id = new_org_id, role = 'fleet_manager' where id = auth.uid();

  return new_org_id;
end;
$$;

grant execute on function create_organization_as_owner(text) to authenticated;
