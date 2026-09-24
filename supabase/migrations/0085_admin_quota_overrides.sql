-- Admin-settable "design partner" quota override: lets dispatcher_admin grant
-- a specific user a free-but-generous coordination quota above their plan's
-- normal free-tier limit (Ohad's pre-launch design-partner program — free
-- access with full admin control over how much, converted to a real paid
-- plan manually later, since there's still no billing processor wired in).
--
-- Deliberately its own table, not new columns on profiles: profiles RLS lets
-- a user read their OWN row in full ("Users read their own profile"), and
-- several server components already do `select("*")` on it (profile/page.tsx,
-- layout.tsx) to hand to client components — any admin note/audit trail
-- bolted onto profiles would ride along in that payload straight to the
-- browser. Postgres RLS is row-level only (see 0049's own note on this), so
-- column-level secrecy has to come from a separate table plus a
-- security-definer function that controls exactly what it returns — the same
-- pattern 0049 used to keep marketplace_freelancers() from leaking phone
-- numbers.
create table coordination_quota_overrides (
  user_id uuid primary key references profiles (id) on delete cascade,
  override_count integer not null check (override_count > 0),
  override_period text not null check (override_period in ('week', 'month')),
  override_complex_allowed integer not null default 0 check (override_complex_allowed >= 0),
  note text,
  set_by uuid references profiles (id) on delete set null,
  set_at timestamptz not null default timezone('utc', now())
);

alter table coordination_quota_overrides enable row level security;

-- No policy grants the row's own user any access — admin-only, by design
-- (see comment above). The security-definer function below is the ONLY way
-- a user's own session ever sees their own numbers, and it returns only
-- three columns — never note/set_by/set_at.
create policy "Dispatcher admins manage quota overrides"
  on coordination_quota_overrides for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

-- The signed-in user's own override, numbers only. Used by both server-side
-- quota enforcement (actions/flight-requests.ts) and the client-side quota
-- display (useCoordinationQuota) so a design partner just sees a
-- normal-looking quota — never any hint that it's an admin override.
create or replace function my_coordination_override()
returns table (
  override_count integer,
  override_period text,
  override_complex_allowed integer
)
language sql
stable
security definer set search_path = public
as $$
  select override_count, override_period, override_complex_allowed
  from coordination_quota_overrides
  where user_id = auth.uid();
$$;

grant execute on function my_coordination_override() to authenticated;
