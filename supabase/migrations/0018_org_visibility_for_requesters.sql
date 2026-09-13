-- A user who just requested to join an org (status still 'pending') can't
-- read the org's name yet, because "Members read their own organization"
-- only matches their *active* org (current_org_id()). That makes the
-- "my memberships" list show "—" for a request the user just submitted.
-- Let anyone with *any* membership row (pending, active, or otherwise) read
-- the org's public identity.

create policy "Requesters read orgs they have a membership row for"
  on organizations for select
  using (
    exists (
      select 1 from organization_members
      where organization_members.org_id = organizations.id
        and organization_members.user_id = auth.uid()
    )
  );
