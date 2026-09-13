-- A fleet manager reviewing a pending join request needs to see the
-- applicant's name and phone, but "Org members read teammate profiles"
-- only matches profiles whose org_id already equals the fleet manager's org
-- — which a *pending* applicant's profile doesn't have yet (they haven't
-- been approved). Without this, PostgREST's embed drops the whole pending
-- row because the joined profiles read fails RLS, so the requests list
-- silently renders empty.

create policy "Fleet managers read profiles of their applicants"
  on profiles for select
  using (
    exists (
      select 1 from organization_members om
      where om.user_id = profiles.id
        and om.org_id = current_org_id()
    )
  );
