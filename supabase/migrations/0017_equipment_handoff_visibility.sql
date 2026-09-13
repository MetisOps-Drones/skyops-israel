-- A contractor deciding what's available to check out needs to see whether
-- *someone else* already has a given org drone out, not just their own
-- handoff history. "Users manage their own handoffs" (0016) only exposes a
-- pilot's own rows, so add read access for any active member of the org
-- that owns the drone.

create policy "Org members read handoffs on their org's drones"
  on equipment_handoffs for select
  using (
    exists (
      select 1 from drones d
      where d.id = equipment_handoffs.drone_id
        and d.org_id is not null
        and is_same_org(d.org_id)
    )
  );
