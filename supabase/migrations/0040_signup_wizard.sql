-- Supports the signup-time onboarding wizard: the customer classifies themselves (hobby /
-- professional / business) and answers a couple of follow-up questions *during* signup, and the
-- system pre-selects a recommended plan (or a 7-day trial for the paid org tiers) instead of
-- leaving that to be configured later inside the app.

alter table profiles
  add column if not exists professional_category text,
  add column if not exists trial_ends_at timestamptz;

-- Extended to also seed plan_code / professional_category / freelance_available from the
-- signup wizard's metadata when present, so the wizard's recommendation is live immediately
-- instead of requiring a follow-up profile update right after account creation.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, plan_code, professional_category, freelance_available)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Pilot'),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'pilot_hobby'),
    new.raw_user_meta_data ->> 'plan_code',
    new.raw_user_meta_data ->> 'professional_category',
    coalesce((new.raw_user_meta_data ->> 'freelance_available')::boolean, false)
  );
  return new;
end;
$$;
