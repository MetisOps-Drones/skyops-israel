-- ohad@metis-ops.com is the platform owner — force dispatcher_admin (the platform-wide staff
-- role) regardless of what the signup wizard or an OAuth provider would otherwise set, so this
-- works whether the account is created via email/password or Google/Apple sign-in. Also widens
-- the full_name fallback to 'name' (some OAuth providers, notably Apple, populate that key
-- instead of 'full_name') before falling back to email/"Pilot".
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, plan_code, professional_category, freelance_available)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email, 'Pilot'),
    case
      when lower(new.email) = 'ohad@metis-ops.com' then 'dispatcher_admin'::user_role
      else coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'pilot_hobby')
    end,
    new.raw_user_meta_data ->> 'plan_code',
    new.raw_user_meta_data ->> 'professional_category',
    coalesce((new.raw_user_meta_data ->> 'freelance_available')::boolean, false)
  );
  return new;
end;
$$;

-- Safety net in case that account already exists from before this trigger change.
update profiles set role = 'dispatcher_admin'
where id in (select id from auth.users where lower(email) = 'ohad@metis-ops.com');
