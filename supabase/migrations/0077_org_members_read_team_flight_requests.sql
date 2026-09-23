-- A fleet manager had no way to see their team's coordination activity
-- anywhere in the app — not a UI gap, a real RLS gap: flight_requests only
-- had policies for "the requester themselves" and "dispatcher_admin"
-- (0011_rls_policies.sql), unlike flight_logs which already has an
-- equivalent "Org members read fleet flight logs" policy. Any UI built on
-- top of a query here would have silently returned nothing for a fleet
-- manager. Mirrors that flight_logs policy's shape: any member of the same
-- org as the requester can read it (not fleet-manager-only — same
-- generosity flight_logs already grants), joining through profiles since
-- flight_requests has no org_id column of its own.
create policy "Org members read team flight requests"
  on flight_requests for select
  using (
    exists (
      select 1 from profiles p
      where p.id = flight_requests.user_id
        and p.org_id is not null
        and is_same_org(p.org_id)
    )
  );
