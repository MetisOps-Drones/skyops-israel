-- Plan selection (demo-checkout tracking, no real billing processor — same convention as the
-- existing org-upgrade and academy paywall flows), structured weekly business hours for the
-- "פרטי עסק" settings section, and read access for the freelancer marketplace (org accounts only).

alter table profiles
  add column if not exists plan_code text,
  add column if not exists business_hours jsonb;

create policy "Org members read marketplace-visible freelancer profiles"
  on profiles for select
  using (freelance_available = true and current_org_id() is not null);
