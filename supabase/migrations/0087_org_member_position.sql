-- Separates "what this person is inside the org" from two things it was
-- getting conflated with: their subscription (profiles.plan_code, billing
-- only) and the permission-bearing organization_members.role (still exactly
-- 'fleet_manager' or 'pilot_pro' — it drives is_org_fleet_manager() and RLS,
-- left untouched on purpose). An org on any subscription tier can still have
-- a fleet manager who's ALSO informally "the recruiter", or a contractor
-- pilot who's specifically brought on as a "test pilot" — real distinctions
-- today's schema has no field for. `position` is free text on purpose
-- (not a new enum): it's a label the org itself defines, not a set of
-- platform-wide permission tiers, so it shouldn't need a migration every
-- time someone invents a new title.
alter table organization_members
  add column if not exists position text;

comment on column organization_members.position is
  'Free-text job title/function within the org (e.g. "מנהל צי", "מגייסת", "מטיס ניסוי") -- display only. organization_members.role stays the permission-bearing field (fleet_manager vs pilot_pro); this never gates anything.';
