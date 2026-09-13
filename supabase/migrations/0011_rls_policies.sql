-- Row Level Security. Every table a client can reach is locked down here;
-- server-side code that needs to bypass this (the cron sweep, NOTAM publish
-- notifications) uses the service-role key, which ignores RLS entirely.

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table organization_members enable row level security;
alter table pilot_licenses enable row level security;
alter table drones enable row level security;
alter table batteries enable row level security;
alter table airspace_zones enable row level security;
alter table flight_requests enable row level security;
alter table flight_logs enable row level security;
alter table lms_progress enable row level security;
alter table documents enable row level security;
alter table notifications enable row level security;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create policy "Members read their own organization"
  on organizations for select
  using (id = current_org_id() or is_dispatcher_admin());

create policy "Fleet managers update their own organization"
  on organizations for update
  using (
    id = current_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'fleet_manager')
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "Users read their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Org members read teammate profiles"
  on profiles for select
  using (org_id is not null and org_id = current_org_id());

create policy "Dispatcher admins read every profile"
  on profiles for select
  using (is_dispatcher_admin());

create policy "Users update their own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create policy "Org members read their roster"
  on organization_members for select
  using (org_id = current_org_id() or is_dispatcher_admin());

create policy "Fleet managers manage their roster"
  on organization_members for all
  using (
    org_id = current_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'fleet_manager')
  )
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- pilot_licenses
-- ---------------------------------------------------------------------------
create policy "Pilots manage their own licenses"
  on pilot_licenses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Dispatcher admins read all licenses"
  on pilot_licenses for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- drones
-- ---------------------------------------------------------------------------
create policy "Owners manage their own drones"
  on drones for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Org members read their fleet"
  on drones for select
  using (org_id is not null and is_same_org(org_id));

create policy "Fleet managers manage their fleet"
  on drones for all
  using (
    org_id is not null
    and is_same_org(org_id)
    and exists (select 1 from profiles where id = auth.uid() and role = 'fleet_manager')
  )
  with check (org_id is not null and is_same_org(org_id));

create policy "Dispatcher admins read all drones"
  on drones for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- batteries (access follows the parent drone)
-- ---------------------------------------------------------------------------
create policy "Users manage batteries on drones they can manage"
  on batteries for all
  using (
    exists (
      select 1 from drones d
      where d.id = batteries.drone_id
        and (
          d.user_id = auth.uid()
          or (d.org_id is not null and is_same_org(d.org_id))
        )
    )
  )
  with check (
    exists (
      select 1 from drones d
      where d.id = batteries.drone_id
        and (
          d.user_id = auth.uid()
          or (d.org_id is not null and is_same_org(d.org_id))
        )
    )
  );

create policy "Dispatcher admins read all batteries"
  on batteries for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- airspace_zones — reference data, readable by every signed-in user,
-- writable only by dispatcher admins maintaining the regulatory boundaries.
-- ---------------------------------------------------------------------------
create policy "Authenticated users read airspace zones"
  on airspace_zones for select
  using (auth.role() = 'authenticated');

create policy "Dispatcher admins manage airspace zones"
  on airspace_zones for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- flight_requests
-- ---------------------------------------------------------------------------
create policy "Pilots manage their own flight requests"
  on flight_requests for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Dispatcher admins manage every flight request"
  on flight_requests for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- flight_logs
-- ---------------------------------------------------------------------------
create policy "Pilots manage their own flight logs"
  on flight_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Org members read fleet flight logs"
  on flight_logs for select
  using (
    exists (
      select 1 from drones d
      where d.id = flight_logs.drone_id
        and d.org_id is not null
        and is_same_org(d.org_id)
    )
  );

create policy "Dispatcher admins read all flight logs"
  on flight_logs for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- lms_progress
-- ---------------------------------------------------------------------------
create policy "Users manage their own LMS progress"
  on lms_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create policy "Users manage their own documents"
  on documents for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Dispatcher admins read all documents"
  on documents for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create policy "Users read their own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Users mark their own notifications read"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
